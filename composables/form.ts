import type { infer, z } from 'zod'
import { reactive, toRefs } from 'vue'
import { objectKeys } from 'utilipea'

export type UseFormOptions<TSchema extends z.ZodType<any, any, any>> = {
  schema: TSchema
  initialValues?: Partial<z.infer<TSchema>>
}

export function useForm<TSchema extends z.ZodObject<any, any>>({
  schema,
  initialValues = {}
}: UseFormOptions<TSchema>) {
  type SchemaType = z.infer<typeof schema>

  function createReactive<T extends Record<string, unknown>>(obj: T): T {
    return reactive(obj) as T
  }

  const defaultValues = Object.keys(schema.shape).reduce((acc, key) => {
    acc[key] = undefined
    return acc
  }, {} as Record<string, undefined>)

  const values = createReactive<SchemaType>({
    ...defaultValues,
    ...initialValues
  })

  return {
    values: readonly(values),
    fields: toRefs(values),
  }
}
