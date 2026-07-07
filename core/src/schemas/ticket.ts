import { z } from "zod";

export const ticketStatuses = ["open", "resolved", "closed"] as const;
export const ticketCategories = ["BUG", "FEATURE", "QUESTION", "OTHER"] as const;

export const updateTicketStatusSchema = z.object({
  status: z.enum(ticketStatuses),
});

export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  category: z.enum(ticketCategories).optional(),
  requesterName: z.string().trim().optional(),
  requesterEmail: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "Enter a valid email",
    })
    .optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
