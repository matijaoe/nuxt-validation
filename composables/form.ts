import { set } from '@vueuse/core'
import { clone, objectKeys } from 'utilipea'
import { reactive, toRefs } from 'vue'
import type { TypeOf, z } from 'zod'

// to me, best seems, on initial intereaction, as soon as you become valid (or blur), start validating

/*
ideas
mode: {
  inital: 'blur' | 'input' | 'submit' | 'touch'
  onInvalid: 'blur' | 'input'
  afterSubmit: 'blur' | 'input'
}
 */

/*
- aggressive - validate on input, all the time
- touch - initially validate only after touch (blur), on input thereafter
- eager - initially validate when touched OR as soon as as it becomes valid (even before first blur/touch), so that it shows errors when going from inital valid to invalid
- lazy - validate on blur
- smartLazy - initially validate on blur, validate and blur AND until and when invalid (until valid) thereafter
- submitThenEager - validate on submit, validate on input thereafter
- submitThenLazy - validate on submit, validate on input thereafter
- submit - validate on submit only
*/

export type FormValidationMode = 'touch' | 'eager' | 'lazy' | 'smartLazy' | 'aggressive' | 'submit'
export type FormValidationModeAfterSubmit = 'input' | 'blur' | 'submit'

export type UseFormOptions<TSchema extends z.ZodType<any, any, any>> = {
  schema: TSchema
  initialValues?: Partial<z.infer<TSchema>>
  mode?: FormValidationMode
  modeAfterSubmit?: FormValidationModeAfterSubmit
}

function createReactive<T extends Record<string, unknown>>(obj: T): T {
  return reactive(obj) as T
}

type FormMeta = {
  touched: boolean
  dirty: boolean
  invalid: boolean
  validated: boolean // entire form has been validated
  anyValidated: boolean // any field has been validated
}

type FieldMeta = {
  touched: boolean
  dirty: boolean
  invalid: boolean
  validated: boolean
}

// ----------------------------------------------------------
// useForm
// ----------------------------------------------------------
export function useForm<TSchema extends z.ZodObject<any, any>>({
  schema,
  initialValues = {},
  mode = 'smartLazy',
  modeAfterSubmit = 'input',
}: UseFormOptions<TSchema>) {
  const {
    count: submitCount,
    inc: incSubmitCount,
  } = useCounter(0)
  const isSubmitting = ref(false)
  const isValidating = ref(false)

  // const meta: FormMeta = reactive({
  //   touched: false,
  //   dirty: false,
  //   invalid: false,
  // })

  const isSubmitted = computed(() => submitCount.value > 0)

  type SchemaType = z.infer<typeof schema>
  type SchemaTypeKey = keyof SchemaType

  const schemaKeys = computed(() => objectKeys(schema.shape) as SchemaTypeKey[])

  const defaultValues = schemaKeys.value.reduce((acc, field) => {
    acc[field] = undefined
    return acc
  }, {} as Record<SchemaTypeKey, undefined>)

  const values = createReactive<SchemaType>(clone({
    ...defaultValues,
    ...initialValues
  }))

  const fieldsMeta = reactive(
    schemaKeys.value.reduce((acc, key) => {
      acc[key] = {
        touched: false,
        dirty: false,
        invalid: false,
        validated: false,
      }
      return acc
    }, {} as Record<SchemaTypeKey, FieldMeta>)
  ) as Record<SchemaTypeKey, FieldMeta>

  const formMeta = computed<FormMeta>(() => {
    const fieldMetaValues = Object.values(fieldsMeta)

    const someFieldMetaValues = (metaItem: keyof FieldMeta) => fieldMetaValues.some((meta) => meta[metaItem])

    const touched = someFieldMetaValues('touched')
    const dirty = someFieldMetaValues('dirty')
    const invalid = someFieldMetaValues('invalid')
    const anyValidated = someFieldMetaValues('validated')

    const validated = fieldMetaValues.every((meta) => meta.validated)

    return {
      touched,
      dirty,
      invalid,
      anyValidated,
      validated
    }
  })

  const errors = shallowRef({} as Record<SchemaTypeKey, string | undefined>)

  const clearErrors = () => {
    errors.value = {} as Record<SchemaTypeKey, string | undefined>
  }

  const reset = () => {
    Object.assign(values, clone({ ...defaultValues, ...initialValues }))
    clearErrors()
  }

  const setFieldValue = (field: SchemaTypeKey, value: any) => {
    values[field] = clone(value)
  }

  const setFormValues = (fields: Partial<SchemaType>) => {
    Object.assign(values, clone(fields))
  }

  const setFieldError = (field: SchemaTypeKey, error: string) => {
    errors.value[field] = clone(error)
  }

  const validateFieldDryRun = async (field: SchemaTypeKey) => {
    const fieldSchema = schema.pick({ [field]: true } as { [key in SchemaTypeKey]: true })

    const parseRes = await fieldSchema.safeParseAsync({ [field]: values[field] })

    return parseRes.success
  }

  const validateField = async (field: SchemaTypeKey) => {
    const fieldSchema = schema.pick({ [field]: true } as { [key in SchemaTypeKey]: true })

    const parseRes = await fieldSchema.safeParseAsync({ [field]: values[field] })

    fieldsMeta[field].invalid = !parseRes.success
    fieldsMeta[field].validated = true

    if (parseRes.success) {
      errors.value = {
        ...errors.value,
        [field]: undefined
      }

      return {
        valid: true,
      }
    }
    const fieldErrors = (parseRes.error.formErrors.fieldErrors as Record<keyof TypeOf<TSchema>, string[]>)[field]
    const [firstError] = fieldErrors

    errors.value = {
      ...errors.value,
      [field]: firstError
    }

    return {
      valid: parseRes.success,
      error: firstError,
      errors: fieldErrors,
    }
  }

  const validate = async () => {
    const parseRes = await schema.safeParseAsync(values)

    // set every field as touched
    schemaKeys.value.forEach((field) => {
      fieldsMeta[field].touched = true
      fieldsMeta[field].validated = true
    })

    clearErrors()

    const results = objectKeys(values).reduce((acc, field) => {
      acc[field] = { errors: [], valid: true }
      return acc
    }, {} as Record<SchemaTypeKey, { errors: string[]; valid: boolean }>)

    if (!parseRes.success) {
      const fieldErrors = parseRes.error.formErrors.fieldErrors as Record<SchemaTypeKey, string[]>

      objectKeys(fieldErrors).forEach((key) => {
        const fieldErrorsArray = fieldErrors[key]
        const [firstError] = fieldErrorsArray

        errors.value[key] = firstError
        results[key] = {
          errors: fieldErrorsArray,
          valid: !fieldErrorsArray.length
        }
      })
    }

    return {
      valid: parseRes.success,
      errors: errors.value,
      results,
    }
  }

  const handleSubmit = ({ onValid, onInvalid }: {
    onValid: (values: Readonly<SchemaType>) => void
    onInvalid?: (errors: Record<keyof z.TypeOf<TSchema>, {
      errors: string[]
      valid: boolean
    }>) => void
  }) => async () => {
    incSubmitCount()

    set(isSubmitted, true)
    set(isValidating, true)

    const result = clone(await validate())

    set(isValidating, false)

    if (result.valid) {
      // TODO: not sure in which format to pass
      onValid(readonly(toRaw(values)))
    } else {
      onInvalid?.(result.results)
    }

    set(isSubmitting, false)
  }

  function fieldElementName(e: Event) {
    return (e.currentTarget as HTMLInputElement)?.name
  }

  function isValidFieldName(name: string): boolean {
    return schemaKeys.value.includes(name)
  }

  const setFieldTouched = (field: SchemaTypeKey, value: boolean) => {
    fieldsMeta[field].touched = value
  }

  // TODO: this seems out of place
  if (mode === 'eager') {
    schemaKeys.value.forEach(async (field) => {
      const valid = await validateFieldDryRun(field)
      if (valid) {
        fieldsMeta[field].validated = true
      }
    })
  }

  const fieldHandlers = {
    input: async (e: InputEvent) => {
      const name = fieldElementName(e)
      if (!isValidFieldName(name)) { return }

      const fieldMeta = fieldsMeta[name]

      fieldMeta.dirty = true

      if (isSubmitted.value) {
        if (modeAfterSubmit === 'input') {
          nextTick(() => {
            validateField(name)
          })
        }
        return
      }

      switch (mode) {
        case 'aggressive':
          nextTick(() => {
            validateField(name)
          })
          break
        case 'touch': {
          if (fieldMeta.touched) {
            nextTick(() => {
              validateField(name)
            })
          }
          break
        }
        // not too great, should take into account if its initially valid (set inital value)
        case 'eager': {
          if (fieldMeta.touched || fieldMeta.validated) {
            nextTick(() => {
              validateField(name)
            })
            return
          }
          // TODO: no unnecessary double validation
          // field not touched (no blur event yet)
          // do dry run validation
          // mark it as validataed when it becomes valid
          nextTick(async () => {
            const valid = await validateFieldDryRun(name)
            if (valid) {
              fieldMeta.validated = true
              validateField(name)
            }
          })
          break
        }
        case 'smartLazy':
          if (fieldMeta.invalid) {
            nextTick(() => {
              validateField(name)
            })
          }
          break
        case 'lazy':
        case 'submit':
          break
      }
    },
    blur: (e: FocusEvent) => {
      const name = fieldElementName(e)
      if (!isValidFieldName(name)) { return }

      const fieldMeta = fieldsMeta[name]

      fieldMeta.touched = true

      if (isSubmitted.value) {
        if (modeAfterSubmit === 'blur') {
          nextTick(() => {
            validateField(name)
          })
        }
        return
      }

      switch (mode) {
        case 'aggressive':
        case 'touch':
        case 'eager':
        case 'smartLazy':
        case 'lazy':
          nextTick(() => {
            validateField(name)
          })
          break
        case 'submit':
          break
      }
    }
  }

  return {
    values: readonly(values),
    errors: readonly(errors),
    fields: toRefs(values),
    submitCount: readonly(submitCount),
    isSubmitting: readonly(isSubmitting),
    // individual fields functions
    setFieldTouched,
    setFieldValue,
    setFieldError,
    validateField, // wip
    setFormValues,
    // form functions
    handleSubmit,
    validate,
    reset,
    meta: toRef(formMeta),
    fieldsMeta: toRef(fieldsMeta),
    onField: fieldHandlers
  }
}
