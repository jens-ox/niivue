const { snapshot, httpServerAddress, seconds } = require('./helpers')
beforeEach(async () => {
  await page.goto(httpServerAddress, { timeout: 0 })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
})
test('canvasPos2frac', async () => {
  const frac = await page.evaluate(async () => {
    let opts = {
      textHeight: 0.05, // larger text
      crosshairColor: [0, 0, 1, 1] // green
    }
    const nv = new Niivue((opts = opts))
    await nv.attachTo('gl', false)

    // load one volume object in an array
    const volumeList = [
      {
        url: './images/mni152.nii.gz', // "./RAS.nii.gz", "./spm152.nii.gz",
        volume: { hdr: null, img: null },
        name: 'mni152.nii.gz',
        intensityMin: 0, // not used yet
        intensityMax: 100, // not used yet
        intensityRange: [0, 100], // not used yet
        colormap: 'gray',
        opacity: 1,
        visible: true
      }
    ]
    await nv.loadVolumes(volumeList)
    const pos = [100, 200]
    const frac = nv.canvasPos2frac(pos)
    return frac
  })
  const expected = [0.4045893719806762, 0.5, 0.5]
  for (let i = 0; i < frac.length; i++) {
    expect(frac[i]).toBeCloseTo(expected[i])
  }
})
