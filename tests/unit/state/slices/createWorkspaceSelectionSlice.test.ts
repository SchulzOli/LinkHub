import { beforeEach, describe, expect, it } from 'vitest'
import { create, type StoreApi } from 'zustand'

import { createWorkspaceSelectionSlice } from '../../../../src/state/slices/createWorkspaceSelectionSlice'
import type { WorkspaceSelectionState } from '../../../../src/state/workspaceStoreTypes'

type SelectionStore = StoreApi<WorkspaceSelectionState>

let store: SelectionStore

beforeEach(() => {
  store = create<WorkspaceSelectionState>((set, get, api) =>
    createWorkspaceSelectionSlice(set as never, get as never, api as never),
  )
})

function state() {
  return store.getState()
}

describe('createWorkspaceSelectionSlice', () => {
  it('starts with empty selections', () => {
    expect(state().selectedCardIds).toEqual([])
    expect(state().selectedGroupIds).toEqual([])
    expect(state().selectedPictureIds).toEqual([])
  })

  it('setSelectedCardIds clears other selections', () => {
    state().setSelectedGroupIds(['g-1'])
    state().setSelectedCardIds(['c-1', 'c-2'])

    expect(state().selectedCardIds).toEqual(['c-1', 'c-2'])
    expect(state().selectedGroupIds).toEqual([])
    expect(state().selectedPictureIds).toEqual([])
  })

  it('setSelectedGroupIds clears cards and pictures', () => {
    state().setSelectedCardIds(['c-1'])
    state().setSelectedPictureIds(['p-1'])
    state().setSelectedGroupIds(['g-1'])

    expect(state().selectedGroupIds).toEqual(['g-1'])
    expect(state().selectedCardIds).toEqual([])
    expect(state().selectedPictureIds).toEqual([])
  })

  it('setSelectedPictureIds clears cards and groups', () => {
    state().setSelectedCardIds(['c-1'])
    state().setSelectedPictureIds(['p-1', 'p-2'])

    expect(state().selectedPictureIds).toEqual(['p-1', 'p-2'])
    expect(state().selectedCardIds).toEqual([])
  })

  it('setSelection replaces every selection bucket', () => {
    state().setSelection({
      cardIds: ['c-1'],
      groupIds: ['g-1'],
      pictureIds: ['p-1'],
    })

    expect(state().selectedCardIds).toEqual(['c-1'])
    expect(state().selectedGroupIds).toEqual(['g-1'])
    expect(state().selectedPictureIds).toEqual(['p-1'])
  })

  it('selectCardExclusive/selectGroupExclusive/selectPictureExclusive select only one item', () => {
    state().setSelection({
      cardIds: ['c-1', 'c-2'],
      groupIds: ['g-1'],
      pictureIds: ['p-1'],
    })

    state().selectCardExclusive('c-3')
    expect(state().selectedCardIds).toEqual(['c-3'])
    expect(state().selectedGroupIds).toEqual([])
    expect(state().selectedPictureIds).toEqual([])

    state().selectGroupExclusive('g-9')
    expect(state().selectedGroupIds).toEqual(['g-9'])
    expect(state().selectedCardIds).toEqual([])

    state().selectPictureExclusive('p-9')
    expect(state().selectedPictureIds).toEqual(['p-9'])
    expect(state().selectedGroupIds).toEqual([])
  })

  it('toggleCardSelection adds and removes an id', () => {
    state().toggleCardSelection('c-1')
    expect(state().selectedCardIds).toEqual(['c-1'])

    state().toggleCardSelection('c-2')
    expect(state().selectedCardIds).toEqual(['c-1', 'c-2'])

    state().toggleCardSelection('c-1')
    expect(state().selectedCardIds).toEqual(['c-2'])
  })

  it('toggleGroupSelection / togglePictureSelection mirror card toggle behaviour', () => {
    state().toggleGroupSelection('g-1')
    state().toggleGroupSelection('g-2')
    state().toggleGroupSelection('g-1')
    expect(state().selectedGroupIds).toEqual(['g-2'])

    state().togglePictureSelection('p-1')
    state().togglePictureSelection('p-2')
    state().togglePictureSelection('p-1')
    expect(state().selectedPictureIds).toEqual(['p-2'])
  })

  it('toggling an entity clears the other buckets', () => {
    state().setSelectedCardIds(['c-1'])
    state().toggleGroupSelection('g-1')

    expect(state().selectedCardIds).toEqual([])
    expect(state().selectedGroupIds).toEqual(['g-1'])
  })

  it('clear helpers only clear the targeted bucket', () => {
    state().setSelection({
      cardIds: ['c-1'],
      groupIds: ['g-1'],
      pictureIds: ['p-1'],
    })

    state().clearSelectedCards()
    expect(state().selectedCardIds).toEqual([])
    expect(state().selectedGroupIds).toEqual(['g-1'])
    expect(state().selectedPictureIds).toEqual(['p-1'])

    state().clearSelectedGroups()
    expect(state().selectedGroupIds).toEqual([])
    expect(state().selectedPictureIds).toEqual(['p-1'])

    state().clearSelectedPictures()
    expect(state().selectedPictureIds).toEqual([])
  })

  it('clearSelection empties all buckets', () => {
    state().setSelection({
      cardIds: ['c-1'],
      groupIds: ['g-1'],
      pictureIds: ['p-1'],
    })

    state().clearSelection()

    expect(state().selectedCardIds).toEqual([])
    expect(state().selectedGroupIds).toEqual([])
    expect(state().selectedPictureIds).toEqual([])
  })
})
