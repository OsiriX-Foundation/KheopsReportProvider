/*
 * Copyright (C) 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const STUDIES_PATH = '/studies';
const SERIES_PATH = '/series';

// The following are all attributes and tags from the DICOM standard
// A constant's name describes the attribute. The value is the stringified,
// non-comma-separated tag associated with it.
const COLUMN_POSITION_TAG = '0048021E';
const COLUMNS_TAG = '00280011';  // Number of columns in the image
// Per-frame Functional Groups Sequence
const FUNCTIONAL_GROUP_SEQUENCE_TAG = '52009230';
const PLANE_POSITION_SEQUENCE_TAG = '0048021A';  // Plane Position Sequence
const ROW_POSITION_TAG = '0048021F';
const ROWS_TAG = '00280010';  // Number of rows in the image
const SERIES_INSTANCE_UID_TAG = '0020000E';
const SOP_INSTANCE_UID_TAG = '00080018';
// Unique identifier for the Series that is part of the Study
const STUDY_INSTANCE_UID_TAG = '0020000D';
// Total number of columns in pixel matrix
const TOTAL_PIXEL_MATRIX_COLUMNS_TAG = '00480006';
// Total number of rows in pixel matrix
const TOTAL_PIXEL_MATRIX_ROWS_TAG = '00480007';

let viewer = null;
let fragmentParameters = {};
let configurationValue = {};

function onLoadInitKheops () {
  initFragmentParameters()
  setConfigurationValue(fragmentParameters.conf_uri)
}

function initFragmentParameters () {
  var search = document.URL.substr(document.URL.indexOf('#')+1)
  fragmentParameters = JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) })
}

function setConfigurationValue (conf_uri) {
  $.ajax({
    url: conf_uri,
    error: function(jqXHR) {
      console.log(jqXHR)
    },
    success: function(value) {
      configurationValue = value
      kheopsUserInfo()
      kheopsLoadSeries()
    }
  });
}

function kheopsUserInfo() {
  $.ajax({
    headers: {
      'Authorization': `${fragmentParameters.token_type} ${fragmentParameters.access_token}`
    },
    url: `${configurationValue.userinfo_endpoint}`,
    error: function(jqXHR) {
      alert(
          'Error - retrieving series failed: ' +
          jqXHR.responseJSON[0].error.code + ' ' +
          jqXHR.responseJSON[0].error.message);
    },
    success: function(user) {
      $('#auth-status').text(`Current user : ${user.email}`);
    }
  });
}

function kheopsLoadSeries () {
  const studyPath = `${STUDIES_PATH}/${fragmentParameters.studyUID}${SERIES_PATH}`;
  $.ajax({
    headers: {
      'Authorization': `${fragmentParameters.token_type} ${fragmentParameters.access_token}`
    },
    url: `${configurationValue.dicomweb_endpoint}${studyPath}`,
    error: function(jqXHR) {
      alert(
          'Error - retrieving series failed: ' +
          jqXHR.responseJSON[0].error.code + ' ' +
          jqXHR.responseJSON[0].error.message);
    },
    success: function(studies) {
      $('#series-select').empty();
      const select = document.getElementById("series-select");
      for (let i = 0; i < studies.length; i++) {
        const option = document.createElement('option');
        option.innerText = 'Serie ' + (i + 1);
        option.value = studies[i][SERIES_INSTANCE_UID_TAG].Value[0];
        select.appendChild(option);
      }
      loadInstancesInSeries($('#series-select option:selected').val())
    }
  });
}

function loadInstancesInSeries (serieUID) {
  if(serieUID.length == 0) return;
  const instancesPath = `${STUDIES_PATH}/${fragmentParameters.studyUID}${SERIES_PATH}/${serieUID}/instances`
  $.ajax({
    headers: {
      'Authorization': `${fragmentParameters.token_type} ${fragmentParameters.access_token}`
    },
    url: `${configurationValue.dicomweb_endpoint}${instancesPath}`,
    error: function(jqXHR) {
      alert(
          'Error - retrieving instances failed: ' +
          jqXHR.responseJSON[0].error.code + ' ' +
          jqXHR.responseJSON[0].error.message);
    },
    success: function(instances) {
      let nextRequests,
        results = [],
        arrayRequests = [];
      for (let i = 0; i < instances.length; i++) {

        nextRequests = $.ajax({
          headers: {
            'Authorization': `${fragmentParameters.token_type} ${fragmentParameters.access_token}`
          },
          url: `${configurationValue.dicomweb_endpoint}${instancesPath}/${instances[i][SOP_INSTANCE_UID_TAG].Value[0]}/metadata`,
          success: function (res) {
            results.push(res[0])
          }
        })
        arrayRequests.push(nextRequests)
      }
      $.when.apply($, arrayRequests).then(function() {
        manageInstances(results, fragmentParameters.studyUID, serieUID)
      });
    }
  });
}

function manageInstances(instances, studyUID, serieUID) {
  try {
    let maxWidthPx = 0;
    let maxHeightPx = 0;
    let tileWidthPx = 0;
    let tileHeightPx = 0;
    let levelWidths = new Set();
    for (let i = 0; i < instances.length; i++) {
      const w =
          Number(instances[i][TOTAL_PIXEL_MATRIX_COLUMNS_TAG].Value);
      levelWidths.add(w);
      const h = Number(instances[i][TOTAL_PIXEL_MATRIX_ROWS_TAG].Value);

      if (w > maxWidthPx) {
        maxWidthPx = w;
      }
      if (h > maxHeightPx) {
        maxHeightPx = h;
      }
      tileWidthPx = Number(instances[i][COLUMNS_TAG].Value);
      tileHeightPx = Number(instances[i][ROWS_TAG].Value);
    }
    const sortedLevelWidths = Array.from(levelWidths.values());
    sortedLevelWidths.sort((a, b) => b - a);

    const countLevels = levelWidths.size;
    // Compute pyramid cache
    // Map of "x,y,z" => {SOPInstanceUID, Frame No.}
    const pyramidMeta =
        calculatePyramidMeta(instances, sortedLevelWidths);

    tileSource = {
      height: maxHeightPx,
      width: maxWidthPx,
      tileSize: tileWidthPx,
      maxLevel: countLevels - 1,
      minLevel: 0,
      getTileUrl: function(level, row, col) {
        const x = 1 + (tileWidthPx * row);
        const y = 1 + (tileHeightPx * col);
        const z = countLevels - 1 - level;
        const key = x + '/' + y + '/' + z;
        const params = pyramidMeta[key];
        const renderedPath = `${configurationValue.dicomweb_endpoint}/wado?studyUID=${studyUID}&seriesUID=${serieUID}&objectUID=${params.SOPInstanceUID[0]}&requestType=WADO&frameNumber=${params.FrameNumber}`
        return renderedPath;
      },
      getLevelScale: function(level) {
        return sortedLevelWidths[countLevels - 1 - level] / maxWidthPx;
      }
    };
    if (viewer == null) {
      viewer = OpenSeadragon({
        id: 'openseadragon',
        prefixUrl: `https://cdn.jsdelivr.net/npm/openseadragon@2.4/build/openseadragon/images/`,
        navigatorSizeRatio: 0.25,
        loadTilesWithAjax: true,
        ajaxHeaders: {
          Accept: 'image/jpeg',
          'Authorization': `${fragmentParameters.token_type} ${fragmentParameters.access_token}`
        },
        showNavigator:  true,
        tileSources: tileSource,
        navigatorHeight:   "120px",
        navigatorWidth:    "145px",
      });
    } else {
      viewer.close();
      viewer.open(tileSource);
    }
  } catch (err) {
    alert(
        `Could not parse DICOM for study, possible reason: DICOM is not
        pathology or damaged image.`);
  }
}

/**
 * Calculate image pyramid metadata.
 * @param {array!} dicomInstances Instances of dicom image.
 * @param {array!} sortedLevelWidths Sorted level widths array.
 * @return {Object!} Image pyramid metadata.
 */
function calculatePyramidMeta(dicomInstances, sortedLevelWidths) {
  let widthToLevelMap = {};
  for (let i = 0; i < sortedLevelWidths.length; i++) {
    widthToLevelMap[sortedLevelWidths[i]] = i;
  }

  let pyramidMeta = {};
  for (let i = 0; i < dicomInstances.length; i++) {
    const sopInstanceUID = dicomInstances[i][SOP_INSTANCE_UID_TAG].Value;
    const frameMeta = dicomInstances[i][FUNCTIONAL_GROUP_SEQUENCE_TAG].Value;

    for (let j = 0; j < frameMeta.length; j++) {
      const frameNumber = j + 1;

      // For (x,y) should actually use
      // FrameContentSequence.DimensionIndexValues which an array of
      // size 2 with [x, y]. The below are pixel values and need to be
      // diveded by frameWidth/frameHeight.
      // PerFrameFunctionalGroupsSequence.PlanePositionSlideSequence.ColumnPositionInTotalImagePixelMatrix
      const x = frameMeta[j][PLANE_POSITION_SEQUENCE_TAG]
                    .Value[0][COLUMN_POSITION_TAG]
                    .Value;
      // PerFrameFunctionalGroupsSequence.PlanePositionSlideSequence.RowPositionInTotalImagePixelMatrix
      const y = frameMeta[j][PLANE_POSITION_SEQUENCE_TAG]
                    .Value[0][ROW_POSITION_TAG]
                    .Value;

      const w = Number(dicomInstances[i][TOTAL_PIXEL_MATRIX_COLUMNS_TAG].Value);
      const z = sortedLevelWidths.indexOf(w);

      const key = x + '/' + y + '/' + z;
      pyramidMeta[key] = {
        'SOPInstanceUID': sopInstanceUID,
        'FrameNumber': frameNumber,
      };
    }
  }
  return pyramidMeta;
}