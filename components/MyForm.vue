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
type Values = z.infer<typeof schema>

const {
  values,
  fields,
  errors,
  isSubmitting,
  reset,
  validateField,
  submitCount,
  handleSubmit
} = useForm({
  schema,
  initialValues: {
    age: 24
  }
})
const { name, email, password, age } = fields

const veeForm = useVeeForm({
  validationSchema: toTypedSchema(schema),
})
const { values: veeValues, defineField, errors: veeErrors, validate: veeValidate } = veeForm
const [veeName] = defineField('name')
const [veeEmail] = defineField('email')
const [veePassword] = defineField('password')
const [veeAge] = defineField('age')

const onSubmit = async (values: Values) => {
  console.log('submit', values)
  await veeValidate()
  // console.log('VEE RES', veeRes)
}

const submitHandler = handleSubmit({
  onValid: onSubmit,
  onInvalid: async (results) => {
    console.log('❌ Validation fail', results)
    await veeValidate()
    // const veeRes = await veeValidate()
    // console.log('VEE RES', veeRes)
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
        <div class="flex flex-col gap-4">
          <UFormGroup :error="errors.name">
            <UInput v-model="name" placeholder="Name" />
          </UFormGroup>
          <UFormGroup :error="errors.email">
            <UInput v-model="email" type="text" placeholder="Email" />
          </UFormGroup>
          <UFormGroup :error="errors.password">
            <UInput v-model="password" type="password" placeholder="Password" />
          </UFormGroup>
          <UFormGroup :error="errors.age">
            <UInput v-model="age" type="number" placeholder="Age" />
          </UFormGroup>

          <div class="flex justify-end gap-2">
            <UButton type="button" variant="ghost" @click="validateField('name')">
              validate name
            </UButton>
            <UButton type="button" variant="ghost" @click="onReset">
              reset
            </UButton>
            <UButton type="submit">
              submit ({{ submitCount }})
            </UButton>
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
