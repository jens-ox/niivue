const { snapshot, httpServerAddress, seconds } = require('./helpers')
beforeEach(async () => {
  await page.goto(httpServerAddress, { timeout: 0 })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
})
test('labels', async () => {
  const nlabels = await page.evaluate(async () => {
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
    nv.addLabel('Insula', { textScale: 2.0, textAlignment: niivue.LabelTextAlignment.CENTER }, [0.0, 0.0, 0.0])
    nv.addLabel(
      'ventral anterior insula',
      { lineWidth: 3.0, textColor: [1.0, 1.0, 0.0, 1.0], lineColor: [1.0, 1.0, 0.0, 1.0] },
      [
        [-33, 13, -7],
        [32, 10, -6]
      ]
    )
    nv.addLabel(
      'dorsal anterior insula',
      { textColor: [0.0, 1.0, 0.0, 1.0], lineWidth: 3.0, lineColor: [0.0, 1.0, 0.0, 1.0] },
      [
        [-38, 6, 2],
        [35, 7, 3]
      ]
    )
    nv.addLabel(
      'posterior insula',
      { textColor: [0.0, 0.0, 1.0, 1.0], lineWidth: 3.0, lineColor: [0.0, 0.0, 1.0, 1.0] },
      [
        [-38, -6, 5],
        [35, -11, 6]
      ]
    )
    nv.addLabel(
      'hippocampus',
      { textColor: [1, 0, 0, 1], lineWidth: 3.0, lineColor: [1, 0, 0, 1] },
      [-25, -15.0, -25.0]
    )
    nv.addLabel(
      'right justified footnote',
      {
        textScale: 0.5,
        textAlignment: niivue.LabelTextAlignment.RIGHT,
        bulletColor: [1.0, 0.0, 1.0, 1.0],
        bulletScale: 0.5
      },
      [0.0, 0.0, 0.0]
    )
    return nv.document.labels.length
  })
  expect(nlabels).toBe(6)
  await snapshot()
})
