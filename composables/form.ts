import { clone, objectKeys } from 'utilipea'
import { reactive, toRefs } from 'vue'
import type { z } from 'zod'

export type UseFormOptions<TSchema extends z.ZodType<any, any, any>> = {
  schema: TSchema
  initialValues?: Partial<z.infer<TSchema>>
}

function createReactive<T extends Record<string, unknown>>(obj: T): T {
  return reactive(obj) as T
}

export function useForm<TSchema extends z.ZodObject<any, any>>({
  schema,
  initialValues = {}
}: UseFormOptions<TSchema>) {
  const { count: submitCount, inc: incSubmitCount, reset: resetSubmitCount } = useCounter(0)
  const isSubmitting = ref(false)

  const isSubmitted = computed(() => submitCount.value > 0)

  type SchemaType = z.infer<typeof schema>
  type SchemaTypeKey = keyof SchemaType

  const defaultValues = Object.keys(schema.shape).reduce((acc, key) => {
    acc[key] = undefined
    return acc
  }, {} as Record<string, undefined>)

  const values = createReactive<SchemaType>({
    ...defaultValues,
    ...clone(initialValues)
  })

  const errors = shallowRef({} as Record<SchemaTypeKey, string | undefined>)

  const clearErrors = () => {
    errors.value = {} as Record<SchemaTypeKey, string | undefined>
  }

  const reset = () => {
    Object.assign(values, {
      ...defaultValues,
      ...clone(initialValues)
    })
    clearErrors()
  }

  if (!isSubmitted.value) {
    watchOnce(isSubmitted, () => {
      watch(values, () => {
        // TODO: messes up reset
        validate()
      })
    })
  }

  const validateField = async (key: SchemaTypeKey) => {
    const field = schema.pick({ [key]: true } as { [key in SchemaTypeKey]: true })
    const parseRes = await field.safeParseAsync({ [key]: values[key] })

    if (parseRes.success) {
      errors.value = {
        ...errors.value,
        [key]: undefined
      }
    } else {
      const [firstError] = parseRes.error.formErrors.fieldErrors[key]!

      errors.value = {
        ...errors.value,
        [key]: firstError
      }
    }
  }

  const validate = async () => {
    const parseRes = await schema.safeParseAsync(values)

    clearErrors()

    const results = objectKeys(values).reduce((acc, key) => {
      acc[key] = { errors: [], valid: true }
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
    onValid: (values: SchemaType) => void
    onInvalid?: (errors: Record<keyof z.TypeOf<TSchema>, {
      errors: string[]
      valid: boolean
    }>) => void
  }) => async () => {
    incSubmitCount()

    isSubmitting.value = true
    const res = await validate()
    isSubmitting.value = false

    if (res.valid) {
      onValid(readonly(toRaw(values)))
    } else {
      onInvalid?.(res.results)
    }
  }

  return {
    values: readonly(values),
    errors: readonly(errors),
    fields: toRefs(values),
    submitCount: readonly(submitCount),
    isSubmitting: readonly(isSubmitting),
    validateField, // wip
    handleSubmit,
    validate,
    reset,
  }
}
