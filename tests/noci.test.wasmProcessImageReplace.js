const { snapshot, httpServerAddress, seconds } = require('./helpers')
beforeEach(async () => {
  await page.goto(httpServerAddress, { timeout: 0 })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
})
test('wasm process image replace', async () => {
  await page.evaluate(async () => {
    const nv = new Niivue()
    await nv.attachTo('gl', false)
    // load one volume object in an array
    const volumeList = [
      {
        url: './images/mni152.nii.gz', // "./RAS.nii.gz", "./spm152.nii.gz",
        volume: { hdr: null, img: null },
        name: 'mni152.nii.gz',
        colormap: 'gray',
        opacity: 1,
        visible: true
      }
    ]
    await nv.loadVolumes(volumeList)
    const niimathCmd = '-dog 1 1.6'
    const addAsOverlay = false
    // use niimath wasm to process image  (dog command shows edges)
    nv.processImage(0, niimathCmd, addAsOverlay)
  })
  // snapshot should be edges
  await snapshot()
})
