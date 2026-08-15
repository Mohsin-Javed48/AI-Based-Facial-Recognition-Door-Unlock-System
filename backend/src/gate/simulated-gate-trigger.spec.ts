import { SimulatedGateTrigger } from './simulated-gate-trigger';

describe('SimulatedGateTrigger', () => {
  it('resolves with a firedAt timestamp and never throws', async () => {
    const trigger = new SimulatedGateTrigger();

    const result = await trigger.trigger();

    expect(result.firedAt).toBeInstanceOf(Date);
  });
});
