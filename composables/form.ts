import { set } from '@vueuse/core'
import { clone, objectKeys } from 'utilipea'
import { reactive, toRefs } from 'vue'
import type { TypeOf, z } from 'zod'

/*
- aggressive - validate on input, all the time
- touch - initially validate only after touch (blur), on input thereafter
- eager - initially validate when touched OR as soon as as it becomes valid (even before first blur/touch), so that it shows errors when going from inital valid to invalid
- lazy - validate on blur
- smartLazy - initially validate on blur, validate and blur AND until and when invalid (until valid) thereafter
- submit - validate on submit only
*/

export type FormValidationMode = 'touch' | 'eager' | 'lazy' | 'smartLazy' | 'aggressive' | 'submit'
export type FormValidationModeAfterSubmit = 'input' | 'blur' | 'submit'

export type UseFormOptions<TSchema extends z.ZodType<any, any, any>> = {
  schema: TSchema
  initialValues?: Partial<z.infer<TSchema>>
  mode?: FormValidationMode
  modeAfterSubmit?: FormValidationModeAfterSubmit
  validateOnMount?: boolean
  dryValidateOnMount?: boolean
}

type FormMeta = {
  touched: boolean
  dirty: boolean
  invalid: boolean
}

type FieldMeta = {
  touched: boolean
  dirty: boolean
  invalid: boolean
}

// ----------------------------------------------------------
// useForm
// ----------------------------------------------------------
export function useForm<TSchema extends z.ZodObject<any, any>>({
  schema,
  initialValues = {},
  mode = 'smartLazy',
  modeAfterSubmit = 'input',
  validateOnMount,
  dryValidateOnMount,
}: UseFormOptions<TSchema>) {
  const {
    count: submitCount,
    inc: incSubmitCount,
  } = useCounter(0)
  const isSubmitting = ref(false)
  const isValidating = ref(false)

  const isSubmitted = computed(() => submitCount.value > 0)

  type SchemaType = z.infer<typeof schema>
  type SchemaTypeKey = keyof SchemaType

  const schemaKeys = computed(() => objectKeys(schema.shape) as SchemaTypeKey[])

  const defaultValues = schemaKeys.value.reduce((acc, field) => {
    acc[field] = undefined
    return acc
  }, {} as Record<SchemaTypeKey, undefined>)

  const values = reactive(clone({
    ...defaultValues,
    ...initialValues
  }))

  const fieldMeta = reactive(
    schemaKeys.value.reduce((acc, key) => {
      acc[key] = {
        touched: false,
        dirty: false,
        invalid: false,
      }
      return acc
    }, {} as Record<SchemaTypeKey, FieldMeta>)
  ) as Record<SchemaTypeKey, FieldMeta>

  const formMeta = computed<FormMeta>(() => {
    const fieldMetaValues = Object.values(fieldMeta)

    const someFieldMeta = (metaItem: keyof FieldMeta) => fieldMetaValues.some((meta) => meta[metaItem])

    const touched = someFieldMeta('touched')
    const dirty = someFieldMeta('dirty')
    const invalid = someFieldMeta('invalid')

    return {
      touched,
      dirty,
      invalid,
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
    fieldMeta[field].dirty = true
    setFieldTouched(field, true)
  }

  const setFormValues = (fields: Partial<SchemaType>) => {
    Object.assign(values, clone(fields))
    schemaKeys.value.forEach((field) => {
      fieldMeta[field].dirty = true
      setFieldTouched(field, true)
    })
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

    fieldMeta[field].invalid = !parseRes.success

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

  const validateForm = async () => {
    const parseRes = await schema.safeParseAsync(values)

    schemaKeys.value.forEach((field) => {
      setFieldTouched(field, true)
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

    const result = clone(await validateForm())

    set(isValidating, false)

    if (result.valid) {
      // TODO: not sure in which format to pass
      onValid(readonly(toRaw(values)))
    } else {
      onInvalid?.(result.results)
    }

    set(isSubmitting, false)
  }

  const setFieldTouched = (field: SchemaTypeKey, value: boolean) => {
    fieldMeta[field].touched = value
  }

  if (validateOnMount) {
    validateForm()
  } else if (dryValidateOnMount) {
    schemaKeys.value.forEach(async (field) => {
      const valid = await validateFieldDryRun(field)
      if (valid) {
        // they are invalid by default anyway
        fieldMeta[field].invalid = false

        // TODO touches ONLY if valid - only because of eager state
        // do i want that?
        setFieldTouched(field, true)
      }
    })
  }

  const fieldHandlers = {
    input: async (field: SchemaTypeKey) => {
      const currentFieldMeta = fieldMeta[field]

      currentFieldMeta.dirty = true

      if (isSubmitted.value) {
        if (modeAfterSubmit === 'input') {
          nextTick(() => {
            validateField(field)
          })
        }
        return
      }

      switch (mode) {
        case 'aggressive':
          nextTick(() => {
            validateField(field)
          })
          break
        case 'touch': {
          if (currentFieldMeta.touched) {
            nextTick(() => {
              validateField(field)
            })
          }
          break
        }
        // not too great, should take into account if its initially valid (set inital value)
        case 'eager': {
          if (currentFieldMeta.touched) {
            nextTick(() => {
              validateField(field)
            })
            return
          }
          // field not touched (no blur event yet)
          // do dry run validation
          // mark it as validated when it becomes valid
          nextTick(async () => {
            const valid = await validateFieldDryRun(field)
            if (valid) {
              setFieldTouched(field, true)
              // TODO: no unnecessary double validation, rethink this
              nextTick(async () => {
                await validateField(field)
              })
            }
          })
          break
        }
        case 'smartLazy':
          if (currentFieldMeta.invalid) {
            nextTick(() => {
              validateField(field)
            })
          }
          break
        case 'lazy':
        case 'submit':
          break
      }
    },
    blur: (field: SchemaTypeKey) => {
      setFieldTouched(field, true)

      if (isSubmitted.value) {
        if (modeAfterSubmit === 'blur') {
          nextTick(() => {
            validateField(field)
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
            validateField(field)
          })
          break
        case 'submit':
          break
      }
    }
  }

  const bindField = (field: SchemaTypeKey) => ({
    field,
    onInput: () => fieldHandlers.input(field),
    onBlur: () => fieldHandlers.blur(field),
  })

  return {
    values: readonly(values), // readonly values
    errors: readonly(errors), // readonly errors
    fields: toRefs(values), // v-models of fields
    submitCount: readonly(submitCount),
    isSubmitting: readonly(isSubmitting),
    meta: toRef(formMeta),
    fieldMeta: toRef(fieldMeta),
    // individual fields functions
    setFieldTouched,
    setFieldValue,
    setFieldError,
    validateField, // wip
    setFormValues,
    // form functions
    handleSubmit,
    validate: validateForm,
    reset,
    bindField,
  }
}
