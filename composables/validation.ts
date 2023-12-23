import { get, groupBy } from 'lodash-es'
import type { ZodTypeAny, z } from 'zod'

export function useValidation<T extends ZodTypeAny>(
  schema: T,
  data: MaybeRefOrGetter<Record<string, unknown>>,
  options?: { mode: 'eager' | 'lazy' }
) {
  // Merge default options with user-defined options
  const opts = Object.assign({}, { mode: 'lazy' }, options)

  // Reactive variables to track form validity and errors
  const isValid = ref(true)
  const errors = ref<Record<string, z.ZodIssue[]> | null>(null)

  // Function to clear errors
  const clearErrors = () => {
    errors.value = null
  }

  // Function to initiate validation watch
  let unwatch: null | (() => void) = null
  const validationWatch = () => {
    if (unwatch !== null) {
      return
    }

    unwatch = watch(
      () => toValue(data),
      async () => {
        await validate()
      },
      { deep: true }
    )
  }

  // Function to perform validation
  const validate = async () => {
    clearErrors()

    // Validate the form data using Zod schema
    const result = await schema.safeParseAsync(toValue(data))

    // Update validity and errors based on validation result
    isValid.value = result.success

    if (!result.success) {
      errors.value = groupBy(result.error.issues, 'path')
      validationWatch()
    }

    return errors
  }

  // Function to scroll to the first error in the form
  const scrolltoError = (selector = '.is-error', options = { offset: 0 }) => {
    const element = document.querySelector(selector)

    if (element) {
      const topOffset = element.getBoundingClientRect().top - document.body.getBoundingClientRect().top - options.offset

      window.scrollTo({
        behavior: 'smooth',
        top: topOffset
      })
    }
  }

  // Function to get the error message for a specific form field, can be used to get errors for nested objects using dot notation path.
  const getError = (path: string) => get(errors.value, `${path.replaceAll('.', ',')}.0.message`)

  // Activate validation watch based on the chosen mode
  if (opts.mode === 'eager') {
    validationWatch()
  }

  // Expose functions and variables for external use
  return { validate, errors, isValid, clearErrors, getError, scrolltoError }
}
