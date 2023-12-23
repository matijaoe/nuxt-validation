<script lang="ts" setup>
import { toTypedSchema } from '@vee-validate/zod'
import { useForm as useVeeForm } from 'vee-validate'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).min(3).max(50),
  email: z.string().email().min(3).max(255),
  password: z.string().min(3).max(255),
  age: z.number().min(18).max(99),
})

const mode: FormValidationMode = 'touch'
const modeAfterSubmit: FormValidationModeAfterSubmit = 'input'
const {
  fields: { name, email, password, age },
  values,
  errors,
  reset,
  clear,
  validateField,
  handleSubmit,
  setFormValues,
  bindField,
  submitCount,
  meta,
  fieldMeta,
  isSubmitting,
} = useForm({
  schema,
  mode,
  modeAfterSubmit,
  dryValidateOnMount: true,
  initialValues: {
    age: 24
  }
})

const veeForm = useVeeForm({
  validationSchema: toTypedSchema(schema),
  validateOnMount: true,
  initialValues: {
    age: 24
  }
})
const { values: veeValues, defineField, errors: veeErrors, validate: veeValidate } = veeForm
const [veeName] = defineField('name')
const [veeEmail] = defineField('email')
const [veePassword] = defineField('password')
const [veeAge] = defineField('age')

const onSubmit = async (values: z.infer<typeof schema>) => {
  console.log('submit', values)
  await veeValidate()
}
console.log(veeForm.errors.value.name)

const submitHandler = handleSubmit({
  onValid: onSubmit,
  onInvalid: async (results) => {
    console.log('❌ Validation fail', results)
  }
})

const onReset = () => {
  reset()
  veeForm.resetForm()
}
</script>

<template>
  <div class="grid grid-cols-2 max-w-4xl mx-auto gap-8">
    <form class="flex flex-col gap-4" @submit.prevent="submitHandler">
      <UCard>
        <div class="flex gap-2">
          <UBadge class="mb-4" size="sm" color="green" variant="soft">
            {{ mode }}
          </UBadge>
          <UBadge class="mb-4" size="sm" color="orange" variant="soft">
            {{ modeAfterSubmit }}
          </UBadge>
        </div>
        <div class="flex flex-col gap-4">
          <UFormGroup :error="errors.name">
            <UInput v-model="name" placeholder="Name" v-bind="bindField('name')" />
          </UFormGroup>
          <UFormGroup :error="errors.email">
            <UInput v-model="email" type="text" placeholder="Email" v-bind="bindField('email')" />
          </UFormGroup>
          <UFormGroup :error="errors.password">
            <UInput v-model="password" type="password" placeholder="Password" v-bind="bindField('password')" />
          </UFormGroup>
          <UFormGroup :error="errors.age">
            <UInput v-model="age" type="number" placeholder="Age" v-bind="bindField('age')" />
          </UFormGroup>

          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              variant="ghost"
              @click="setFormValues({
                age: 99,
                name: 'patrik'
              })"
            >
              set values
            </UButton>
            <UButton type="button" variant="ghost" @click="validateField('name')">
              name
            </UButton>
            <UButton
              type="button"
              variant="ghost"
              @click="clear()"
            >
              clear
            </UButton>
            <UButton type="button" variant="ghost" @click="onReset">
              reset
            </UButton>
            <UButton type="submit">
              submit ({{ submitCount }})
            </UButton>
          </div>

          <div>
            <UCard>
              <strong>meta</strong>
              <pre>{{ meta }}</pre>
            </UCard>
            <UCard>
              <strong>fieldMeta</strong>
              <pre>{{ fieldMeta }}</pre>
            </UCard>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex flex-col gap-4">
          <UFormGroup :error="veeErrors.name">
            <UInput v-model="veeName" placeholder="Name" />
          </UFormGroup>
          <UFormGroup :error="veeErrors.email">
            <UInput v-model="veeEmail" type="email" placeholder="Email" />
          </UFormGroup>
          <UFormGroup :error="veeErrors.password">
            <UInput v-model="veePassword" type="password" placeholder="Password" />
          </UFormGroup>
          <UFormGroup :error="veeErrors.age">
            <UInput v-model="veeAge" type="number" placeholder="Age" />
          </UFormGroup>

          <div class="flex justify-end gap-2">
            <UButton type="button" variant="ghost" @click="onReset">
              reset
            </UButton>
            <UButton type="submit" :loading="isSubmitting">
              submit
            </UButton>
          </div>
        </div>
      </UCard>
    </form>

    <div class="space-y-6">
      <div class="space-y-2">
        <strong>matija</strong>
        <UCard class="overflow-x-auto">
          <strong>values</strong>
          <pre>{{ values }}</pre>
        </UCard>
        <UCard class="overflow-x-auto">
          <strong class="text-red-500">errors</strong>
          <pre>{{ errors }}</pre>
        </UCard>
      </div>
      <div class="space-y-2">
        <strong>Vee-validate</strong>
        <UCard class="overflow-x-auto">
          <pre>{{ veeValues }}</pre>
        </UCard>
        <UCard class="overflow-x-auto">
          <strong class="text-red-500">errors</strong>
          <pre>{{ veeErrors }}</pre>
        </UCard>
        <UCard>
          <pre>{{ veeForm }}</pre>
        </UCard>
      </div>
    </div>
  </div>
</template>
