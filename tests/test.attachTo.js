const { snapshot, httpServerAddress } = require('./helpers')
beforeEach(async () => {
  await page.goto(httpServerAddress, { timeout: 0 })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
})
test('attachTo', async () => {
  const gl = await page.evaluate(async () => {
    nv = new Niivue()
    nv = await nv.attachTo('gl', false)
    return nv.gl
  })
  expect(gl).toBeDefined()
  await snapshot()
})
