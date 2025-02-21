const { httpServerAddress } = require('./helpers')
beforeEach(async () => {
  await page.goto(httpServerAddress, { timeout: 0 })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
})
test('sph2cartDe', async () => {
  const xyz = await page.evaluate(() => {
    const nv = new Niivue()
    const xyz = nv.sph2cartDeg(42, 42)
    return xyz
  })

  expect(xyz).toEqual([0.4972609476841367, -0.5522642316338268, -0.6691306063588582])
})
