import { describe, expect, it } from 'vitest'

import { createTemplateDocument } from '../../../src/features/templates/templateLibrary'
import {
  deleteTemplate,
  getTemplateImageRecords,
  listTemplates,
  putTemplate,
} from '../../../src/storage/templateRepository'

const itWithIndexedDb = typeof indexedDB === 'undefined' ? it.skip : it

describe('template repository', () => {
  itWithIndexedDb(
    'stores templates and their copied image records',
    async () => {
      const imageRecord = {
        asset: {
          id: 'template-image-1',
          name: 'Template image',
          originalFilename: 'template-image-1.png',
          mimeType: 'image/png',
          byteSize: 4,
          isAnimated: false,
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
        blob: new File(['png'], 'template-image-1.png', { type: 'image/png' }),
      }
      const template = createTemplateDocument({
        bundle: {
          cards: [
            {
              id: 'card-1',
              url: 'https://example.com',
              title: 'Card',
              faviconUrl: '/api/favicon/example.png',
              faviconOverrideImageId: 'template-image-1',
              positionX: 0,
              positionY: 0,
              size: { columns: 5, rows: 5 },
              createdAt: '2026-04-04T00:00:00.000Z',
              updatedAt: '2026-04-04T00:00:00.000Z',
            },
          ],
          groups: [],
          pictures: [],
        },
        description: '',
        imageRecords: [imageRecord],
        name: `Template ${Date.now()}`,
      })

      await putTemplate({ records: [imageRecord], template })

      const templates = await listTemplates()
      const storedTemplate = templates.find(
        (candidate) => candidate.id === template.id,
      )
      const storedImages = await getTemplateImageRecords(template.id)

      expect(storedTemplate?.name).toBe(template.name)
      expect(storedImages).toHaveLength(1)
      expect(storedImages[0]?.asset.id).toBe('template-image-1')

      await deleteTemplate(template.id)
    },
  )
})
