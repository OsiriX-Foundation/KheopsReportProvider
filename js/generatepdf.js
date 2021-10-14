const axios = require("axios");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const uuidv4 = require('uuid/v4');
const bigInt = require("big-integer");
const tools = require('./tools')

const tagEncapsulatedPDF = {
  necessaryTag: [
    "00100010", // Patient name
    "00100020", // Patient ID
    "00100030", // Patient Birth Date
    "00100040", // Patient sex
    "0020000D",
    "00080020",
    "00080030",
    "00080090", // Referring Physician's name
    "00200010",
    "00080050", // Accession number
    "00080005",
    "00200010",
    "00081030", // Study description
    "00080201", // Timezone offset
    "00080201", // Timezone offset
    "0020000E", // Series Instance UID
    "00080060", // Modality
    "0008103E", // Series Description
    "00200011", // Series Number
    "00180015", // Body Part Examined

  ],
  createTag: [
    { tag: "00080060", "vr":"CS", value: ["DOC"]},
    { tag: "0020000E", "vr":"UI", value: "OID"},
    { tag: "00200011", "vr":"IS", value: ""},
    { tag: "00080070", "vr":"LO", value: ""},
    { tag: "00080064", "vr":"CS", value: ["SD"]},
    { tag: "00200013", "vr":"IS", value: [1]},
    { tag: "00080023", "vr":"DA", value: ""},
    { tag: "00080033", "vr":"TM", value: ""},
    { tag: "0008002A", "vr":"DT", value: ""},
    { tag: "00280301", "vr":"CS", value: ["YES"]},
    { tag: "00420010", "vr":"ST", value: ""},
    { tag: "0040A043", "vr":"SQ", value: ""},
    { tag: "00420012", "vr":"LO", value: ["application/pdf"]},
    { tag: "00420011", "vr":"OB", value: "BulkDataURI"},
    { tag: "00080016", "vr":"UI", value: ["1.2.840.10008.5.1.4.1.1.104.1"]},
    { tag: "00080018", "vr":"UI", value: "OID"},
  ],
  tagBulkDataURI: '00420011',
  tagStudiesUID: '0020000D',
  tagSeriesUID: '0020000E',
  tagSOPUID: '00080018',
  modelBulkDataUri: 'http://127.0.0.1/dcm4chee-arc/aets/DCM4CHEE/rs',
  transferSyntax: '1.2.840.10008.1.2.4.50'
}

module.exports = {
  createPDF: function(response, StudyUID, TokenSR, urlConfig) {
    const doc = new PDFDocument;
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));

    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      postPDF(urlStudy, config, persistStudy.data[0], pdfData).then(res => {
        tools.responseTextPlain(response, 200, res.data)
      }).catch(err => {
        tools.responseTextPlain(response, 500, err.message)
      })
    })
    const config = generateHeaders(TokenSR)
    let urlStudy = `${urlConfig.dicomweb_endpoint}/studies?includefield=00081030`
    let urlSeries = `${urlConfig.dicomweb_endpoint}/studies/${StudyUID}/series`
    let urlUserInformations = `${urlConfig.userinfo_endpoint}`
    let persistStudy = {}
    let datetime = new Date();
    axios.all([
      getInformations(urlStudy, config), 
      getInformations(urlSeries, config),
      getInformations(urlUserInformations, config)
    ])
      .then(axios.spread(function (study, series, userInfo) {
        persistStudy = study
        doc.fontSize(14)
          .text(`${userInfo.data.name} created this document on ${datetime.toDateString()}.
          `)
        doc.fontSize(14)
          .text(`Study : ${study.data[0]['00081030'] !== undefined ? study.data[0]['00081030']['Value'][0] : study.data[0]['0020000D']['Value'][0]}`)
        doc.text(`Patient name : ${study.data[0]['00100010']['Value'][0]['Alphabetic']}`)
        doc.text(`First modality in this study : ${study.data[0]['00080061']['Value'][0]}
          `)
        doc.text(' ')
        doc.text('Series in the study')
        doc.text(' ')
        let promiseTab = []
        config.responseType='arraybuffer'
        for (var i = 0; i < series.data.length; i++) {
          var promise =  new Promise(function(resolve, reject) {
            let urlWado = `${urlConfig.dicomweb_uri_endpoint}?studyUID=${StudyUID}&seriesUID=${series.data[i]['0020000E']['Value'][0]}&requestType=WADO&rows=250&columns=250&contentType=image%2Fjpeg`
            let serie = series.data[i]
            let id = i+1

            getInformations(urlWado, config).then(res => {
              let result = {
                id: serie['0020000E']['Value'][0],
                text: `${id}. Series ${serie['0008103E'] !== undefined ? serie['0008103E']['Value'][0] : serie['0020000E']['Value'][0]} ${serie['00080060'] !== undefined ? 'with modality ' + serie['00080060']['Value'][0] : ''}`,
                img: res.data
              }
              resolve(result)
            }).catch(err => {
              if (err.response.status === 406) {
                let result = {
                  id: serie['0020000E']['Value'][0],
                  text: `${id}. Series ${serie['0008103E'] !== undefined ? serie['0008103E']['Value'][0] : serie['0020000E']['Value'][0]} ${serie['00080060'] !== undefined ? 'with modality ' + serie['00080060']['Value'][0] : ''}`,
                  img: 'no'
                }
                resolve(result)
              }
              reject(err)
            })
          })
          promiseTab.push(promise)
        }
        Promise.all(promiseTab).then(values => {
          values.forEach(value => {
            doc.text(value.text)
            if (value.img !== 'no') {
              doc.image(value.img)
            }
            doc.text(' ')
          })
          doc.end()
        }).catch(err => {
          console.log(err)
        })
      }))
  }
}

function getInformations(url, config) {
  return axios.get(url, config)
}

function generateHeaders(TokenSR) {
  return {
    headers: {
      'Authorization': `Bearer ${TokenSR}`,
    }
  }
}

function postPDF(url, config, study, pdfData) {
  let dataToPost = generateDicomTag(study)
  dataToPost.boundary = 'myboundary'
  dataToPost.contentTypeHeader = 'Content-Type: application/dicom+json; transfer-syntax='+tagEncapsulatedPDF.transferSyntax
  dataToPost.data = pdfData
  dataToPost.contentType = 'application/pdf'
  /*
  let test_config = generateHeaders('D8sMZyUuhW8HlLtKmXzQxl')
  test_config.headers['Content-Type'] = 'multipart/related; type="application/dicom+json"; boundary='+dataToPost.boundary
  */
  config.headers['Content-Type'] = 'multipart/related; type="application/dicom+json"; boundary='+dataToPost.boundary
  let data = generateMultiPart(dataToPost)
  return axios.post(url, data, config)
}

function generateMultiPart(dataToPost) {
  let header = Buffer.from(`\r\n--${dataToPost.boundary}\r\n${dataToPost.contentTypeHeader}\r\n\r\n${JSON.stringify([dataToPost.orderedEncapsulatedPDF])}\r\n`, 'utf-8')
  let end = Buffer.from(`\r\n--${dataToPost.boundary}--`, 'utf-8')
  let value = Buffer.from(`\r\n--${dataToPost.boundary}\r\nContent-Type: ${dataToPost.contentType}\r\nContent-Location: ${dataToPost.bulkDataUri}\r\n\r\n`, 'utf-8')
  var contents = dataToPost.data
  value = Buffer.concat([value, contents])

  return Buffer.concat([header, value, end])
}

function generateDicomTag (study) {
  let oidSeries = generateOID()
  let oidSOP = generateOID()
  let encapsulatedPDF = {}
  let bulkDataUri = `${tagEncapsulatedPDF.modelBulkDataUri}/studies/${study[tagEncapsulatedPDF.tagStudiesUID]['Value'][0]}/series/${oidSeries}/instances/${oidSOP}`
  tagEncapsulatedPDF.necessaryTag.forEach(currentTag => {
    const value = study[currentTag]
    if (value !== undefined) {
      if (
        currentTag !== tagEncapsulatedPDF.tagSeriesUID &&
        currentTag !== tagEncapsulatedPDF.tagBulkDataURI &&
        currentTag !== tagEncapsulatedPDF.tagSOPUID
      ){
        encapsulatedPDF[currentTag] = value
      }
    }
  })

  tagEncapsulatedPDF.createTag.forEach(value => {
    if (value.value !== '') {
      if (value.tag === tagEncapsulatedPDF.tagSeriesUID) {
        encapsulatedPDF[value.tag] = {
          'vr': value.vr,
          'Value': [oidSeries]
        }
      } else if (value.tag === tagEncapsulatedPDF.tagSOPUID) {
        encapsulatedPDF[value.tag] = {
          'vr': value.vr,
          'Value': [oidSOP]
        }
      } else if (value.tag === tagEncapsulatedPDF.tagBulkDataURI) {
        encapsulatedPDF[value.tag] = {
          'vr': value.vr,
          'BulkDataURI': `${bulkDataUri}`
        }
      } else {
        encapsulatedPDF[value.tag] = {
          'vr': value.vr,
          'Value': value.value
        }
      }
    }
  })

  const orderedEncapsulatedPDF = {}

  Object.keys(encapsulatedPDF).sort().forEach(function (key) {
    orderedEncapsulatedPDF[key] = encapsulatedPDF[key]
  })

  return {orderedEncapsulatedPDF, bulkDataUri}
}

function generateUUID () {
  var uuid = uuidv4().split('-').join('')
  var uuid_bigInt = bigInt(uuid, 16)
  var uuid_array = uuid_bigInt.toArray(10)

  return uuid_array['value'].join('')
}

function generateOID () {
  const uuid = generateUUID()
  var oid = '2.25.'
  oid += uuid
  return oid
}