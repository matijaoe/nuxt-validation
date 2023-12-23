<script lang="ts" setup>
import { z } from 'zod'
import { useForm as useVeeForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'

const schema = z.object({
  name: z.string().min(3).max(255),
  email: z.string().email().min(3).max(255),
  password: z.string().min(3).max(255),
  age: z.number().min(18).max(99),
})

const {
  values,
  fields,
} = useForm({
  schema,
  initialValues: {
    password: '123456',
    age: 23
  }
})
const { name, email, password, age } = fields

const { values: veeValues } = useVeeForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {

  }
})

const onSubmit = (e: Event) => {
  console.log('submit', e)
}
</script>

<template>
  <div class="grid grid-cols-2 max-w-4xl mx-auto gap-8">
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <UInput v-model="name" placeholder="Name" />
      <UInput v-model="email" type="email" placeholder="Email" />
      <UInput v-model="password" type="password" placeholder="Password" />
      <UInput v-model="age" type="number" placeholder="Age" />

      <div class="flex justify-end gap-2">
        <UButton type="submit" variant="ghost">
          reset
        </UButton>
        <UButton type="submit">
          submit
        </UButton>
      </div>
    </form>

    <div class="flex flex-col gap-8">
      <div class="space-y-2">
        <UCard>
          <strong>values</strong>
          <pre>{{ values }}</pre>
        </UCard>
        <UCard>
          <strong>fields</strong>
          <pre>{{ fields }}</pre>
        </UCard>
      </div>
      <UCard>
        <div>Vee-validate</div>
        <pre>{{ veeValues }}</pre>
      </UCard>
    </div>
  </div>
</template>
