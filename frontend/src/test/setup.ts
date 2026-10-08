import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom has no showModal(), so a <dialog> would stay closed and its fields couldn't be used.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function () {
    this.toggleAttribute('open', true)
  }
  HTMLDialogElement.prototype.close = function () {
    this.toggleAttribute('open', false)
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
