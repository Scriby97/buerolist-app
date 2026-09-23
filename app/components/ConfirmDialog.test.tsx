// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

const baseProps = {
  title: 'Löschen',
  message: 'Wirklich löschen?',
  confirmLabel: 'Ja, löschen',
  cancelLabel: 'Abbrechen',
}

describe('ConfirmDialog', () => {
  it('confirms and cancels via the buttons', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />)

    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('exposes an accessible modal dialog labelled by its title', () => {
    render(<ConfirmDialog {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Löschen' })).toHaveAttribute('aria-modal', 'true')
  })

  describe('with requireTypedConfirmation', () => {
    it('keeps the confirm button disabled until the exact text is typed', async () => {
      const onConfirm = vi.fn()
      render(
        <ConfirmDialog
          {...baseProps}
          requireTypedConfirmation="Bergbahnen AG"
          typedConfirmationLabel="Namen eintippen"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      )
      const confirm = screen.getByRole('button', { name: 'Ja, löschen' })
      const input = screen.getByRole('textbox')

      expect(confirm).toBeDisabled()

      await userEvent.type(input, 'bergbahnen ag')
      expect(confirm).toBeDisabled()

      await userEvent.clear(input)
      await userEvent.type(input, 'Bergbahnen AG')
      expect(confirm).toBeEnabled()

      await userEvent.click(confirm)
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('does not confirm while disabled', async () => {
      const onConfirm = vi.fn()
      render(
        <ConfirmDialog
          {...baseProps}
          requireTypedConfirmation="X"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }))

      expect(onConfirm).not.toHaveBeenCalled()
    })
  })
})
