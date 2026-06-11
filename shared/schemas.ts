import { z } from 'zod'

export const currencies = ['USD', 'VES', 'EUR'] as const
export const accountTypes = ['CASH', 'BANK', 'CARD', 'SAVINGS', 'OTHER'] as const
export const transactionTypes = ['INCOME', 'EXPENSE'] as const

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(accountTypes).default('BANK'),
  currency: z.enum(currencies).default('USD'),
  initialBalance: z.coerce.number().finite().default(0),
  archived: z.boolean().default(false),
})

export const accountUpdateSchema = accountSchema.partial()

export const transactionSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid().nullish(),
  type: z.enum(transactionTypes),
  amount: z.coerce.number().positive().finite(),
  date: z.coerce.date(),
  description: z.string().trim().max(200).nullish(),
})

export const transactionUpdateSchema = transactionSchema.partial()

export const transactionQuerySchema = z.object({
  accountId: z.uuid().optional(),
  type: z.enum(transactionTypes).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.string().trim().max(60).nullish(),
  type: z.enum(transactionTypes).nullish(),
})

export type AccountInput = z.infer<typeof accountSchema>
export type TransactionInput = z.infer<typeof transactionSchema>
export type CategoryInput = z.infer<typeof categorySchema>
