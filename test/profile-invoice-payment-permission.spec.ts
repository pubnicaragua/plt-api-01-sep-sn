import { ForbiddenException } from '@nestjs/common'
import { CortesController } from '../src/cortes.controller'
import { profileCanPayInvoices } from '../src/operations.store'

describe('permiso de pago de facturas por perfil', () => {
  it('autoriza siempre al supervisor y solo al operador habilitado', () => {
    expect(profileCanPayInvoices('supervisor', false)).toBe(true)
    expect(profileCanPayInvoices('operator', true)).toBe(true)
    expect(profileCanPayInvoices('operator', false)).toBe(false)
    expect(profileCanPayInvoices('operator', undefined)).toBe(false)
  })

  it('el endpoint de pago exige autorización antes de registrar el pago', () => {
    const markPaid = jest.fn()
    const operations = {
      assertCanPayInvoices: jest.fn(() => {
        throw new ForbiddenException('Este perfil no puede pagar facturas')
      }),
    }
    const controller = new CortesController(
      { markPaid } as never,
      operations as never,
    )

    expect(() => controller.pay('Bearer operador-sin-permiso', 'corte-1', {})).toThrow(
      'Este perfil no puede pagar facturas',
    )
    expect(operations.assertCanPayInvoices).toHaveBeenCalledWith(
      'Bearer operador-sin-permiso',
    )
    expect(markPaid).not.toHaveBeenCalled()
  })
})
