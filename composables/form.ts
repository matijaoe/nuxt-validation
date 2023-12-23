import { set } from '@vueuse/core'
import { clone, objectKeys } from 'utilipea'
import { reactive, toRefs } from 'vue'
import type { TypeOf, z } from 'zod'

export type UseFormOptions<TSchema extends z.ZodType<any, any, any>> = {
  schema: TSchema
  initialValues?: Partial<z.infer<TSchema>>
  mode?: 'eager' | 'lazy'
}

function createReactive<T extends Record<string, unknown>>(obj: T): T {
  return reactive(obj) as T
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
  mode = 'lazy',
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
      }
      return acc
    }, {} as Record<SchemaTypeKey, FieldMeta>)
  ) as Record<SchemaTypeKey, FieldMeta>

  const formMeta = computed<FormMeta>(() => {
    const fieldMetaValues = Object.values(fieldsMeta)
    const touched = fieldMetaValues.some((meta) => meta.touched)
    const dirty = fieldMetaValues.some((meta) => meta.dirty)
    const invalid = fieldMetaValues.some((meta) => meta.invalid)

    return { touched, dirty, invalid }
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

  const validateField = async (field: SchemaTypeKey) => {
    const fieldSchema = schema.pick({ [field]: true } as { [key in SchemaTypeKey]: true })

    const parseRes = await fieldSchema.safeParseAsync({ [field]: values[field] })

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

    // set every field as touched
    schemaKeys.value.forEach((field) => {
      fieldsMeta[field].touched = true
    })

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

  const fieldHandlers = {
    input: (e: InputEvent) => {
      const name = fieldElementName(e)
      if (!isValidFieldName(name)) { return }

      console.log('[input]', name)

      const fieldMeta = fieldsMeta[name]

      fieldMeta.dirty = true

      if (!fieldMeta.touched) {
        return
      }

      if (mode === 'eager') {
        console.log('validate on input')
        nextTick(() => {
          validateField(name)
        })
      } else if (mode === 'lazy' && isSubmitted.value) {
        console.log('validate on input')
        nextTick(() => {
          validateField(name)
        })
      }
    },
    blur: (e: FocusEvent) => {
      const name = fieldElementName(e)
      if (!isValidFieldName(name)) { return }

      console.log('[blur]', name)

      const fieldMeta = fieldsMeta[name]

      fieldMeta.touched = true

      if (mode === 'eager' && !isSubmitted.value) {
        console.log('validate on blur')
        nextTick(() => {
          validateField(name)
        })
      }
    }
  }

  if (mode === 'eager') {
    // schemaKeys.value.forEach((field) => {
    //   watch(() => values[field], () => {
    //     validateField(field)
    //   })
    // })
  } else if (mode === 'lazy' && !isSubmitted.value) {
    // watchOnce(isSubmitted, () => {
    //   schemaKeys.value.forEach((field) => {
    //     watch(() => values[field], () => {
    //       validateField(field)
    //     })
    //   })
    // })
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
    fieldHandlers
  }
}
