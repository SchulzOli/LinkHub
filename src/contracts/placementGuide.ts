import { z } from 'zod'

export const SnapStrengthSchema = z.enum(['low', 'medium', 'high'])

export const PlacementGuideSchema = z.object({
  gridVisible: z.boolean(),
  snapEnabled: z.boolean(),
  snapStrength: SnapStrengthSchema,
  gridSize: z.number().int().positive(),
})

export type SnapStrength = z.infer<typeof SnapStrengthSchema>
export type PlacementGuide = z.infer<typeof PlacementGuideSchema>

export const defaultPlacementGuide: PlacementGuide = {
  gridVisible: true,
  snapEnabled: true,
  snapStrength: 'medium',
  gridSize: 24,
}
