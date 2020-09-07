const N_DIMS = 30; // Número de dimensiones que se mostrarán en los controles deslizantes

const SORTED_DIMS = [73,135,230,177,38,208,172,56,212,211,140,142,150,1,202,74,33,187,206,14,154,2,31,32,244,24,183,173,64,3,108,196,132,29,75,156,131,26,237,164,200,48,218,44,113,167,250,166,90,77,23,185,246,180,217,10,111,213,46,127,216,117,128,16,222,243,240,233,70,9,88,236,179,40,94,4,182,241,78,165,125,25,103,81,66,83,91,124,105,226,247,145,68,238,69,47,254,153,119,5,255,170,158,176,84,225,186,43,99,245,224,168,45,160,63,49,37,61,35,101,141,41,248,209,134,149,147,30,110,188,118,52,67,133,92,95,126,112,15,93,157,107,55,60,130,235,231,6,123,171,114,20,139,162,199,86,51,120,227,85,152,178,80,184,39,215,22,138,192,57,155,252,198,13,50,181,8,121,148,193,204,36,251,219,0,97,220,229,109,21,194,159,72,122,146,87,42,102,189,65,115,253,19,163,201,207,137,100,27,242,34,203,129,210,11,54,232,12,28,98,71,18,205,17,79,249,197,221,223,234,106,76,175,239,136,53,58,89,191,82,190,59,62,174,214,96,161,195,151,116,143,7,104,169,144,228];

init();

var initialMelody;
var actualMelody;
var actualMelody_z;
var initialMelody_z;
var nextMelody;
var savedMelody;
var interpolateSteps;
var filename;
var tempo = 120; // Tempo para el reproductor

/*

Inicializa el programa. Captura el comportamiento de los elementos de la interfaz.

*/

function init() {

  var fileBtn = document.getElementById('fileBtn') // Botón para cargar archivo
  fileBtn.addEventListener('change', loadFile);

  var playBtn = document.getElementById('playBtn') // Botón para reproducir
  playBtn.addEventListener('click', play);

  var addBtn = document.getElementById('addBtn') // Botón para guardar melodía
  addBtn.addEventListener('click', add);

  var interpolateBtn = document.getElementById('interpolateBtn') // Botón para interpolación
  interpolateBtn.addEventListener('click', interpolate);

  var saveAllBtn = document.getElementById('saveAllBtn') // Botón para exportar melodías guardadas
  saveAllBtn.addEventListener('click', () => {
    filename = document.getElementById('filename').value
    saveAs(new File([mm.sequenceProtoToMidi(savedMelody)], filename + '.mid'))
  });

  var saveActBtn = document.getElementById('saveActBtn') // Botón para exportar melodía actual
  saveActBtn.addEventListener('click', () => saveAs(new File([mm.sequenceProtoToMidi(actualMelody[0])], 'autoloops_act_sample.mid')));

  var sliders = document.getElementById('sliders') // Controles deslizantes
  sliders.addEventListener('change', updateFromSliders);

  for (let i = 0; i < N_DIMS; i++) { // Inicializa cada control deslizante
    const div = document.createElement('div');
    div.classList.add('range-wrap');
    div.innerHTML = `<input type="range" data-index=${i} min="-2" max="2" step="0.1" value="0">`;
    sliders.appendChild(div);
  }
}

/*

Inicialización del modelo para melodías de dos compases

*/

const model = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_small');
model.initialize()
    .then(function(MusicVAE) {
        console.log('initialized!');
    });
const player = new mm.Player();


/*

Función para reproducir la melodía actual

*/


async function play(){
  mm.Player.tone.context.resume();
  player.setTempo(tempo);
  player.start(actualMelody[0]);
}

/*

Función para cargar una melodía y actualizar el programa para su uso

*/

async function loadFile() {

  // Convierte la melodía cargada a NoteSequence
  const promises = [];
  for (let i = 0; i < fileInput.files.length; i++) {
    promises.push(mm.blobToNoteSequence(fileInput.files[i]));
  }
  samples = await Promise.all(promises);

  // Hace que la melodía actual sea la melodía cargada
  actualMelody = samples[0];
  // Codifica la melodía actual
  actualMelody_z = await model.encode(setMelody(actualMelody));
  // Fija la melodía inicial como la melodía cargada
  initialMelody_z = actualMelody_z
  initialMelody = actualMelody = await model.decode(actualMelody_z);
  // Guarda la melodía cargada como primera melodía de la secuencia
  savedMelody = actualMelody[0];

  // Visualiza melodía inicial
  vizInput = new mm.PianoRollSVGVisualizer(
  initialMelody[0],
  document.getElementById('vizInit'),
  {noteRGB:'35,70,90', activeNoteRGB:'157, 229, 184', noteHeight:3});

  // Visualiza melodía actual
  vizInput = new mm.PianoRollSVGVisualizer(
  actualMelody[0],
  document.getElementById('vizActual'),
  {noteRGB:'35,70,90', activeNoteRGB:'157, 229, 184', noteHeight:3});

  // Actualiza controles deslizantes
  zArray = actualMelody_z.arraySync()[0]
  updateSliders(zArray)
}

/*

Adapta una NoteSequence para poder ser utilizada por el modelo

*/

function setMelody(mel) {
  let chunks = [];
  let quantizedMel = mm.sequences.quantizeNoteSequence(actualMelody, 4)
  const melChunk = mm.sequences.split(mm.sequences.clone(quantizedMel), 16 * 2);
  chunks = chunks.concat(melChunk);
  return chunks;
}

/*

Actualiza la melodía actual con los datos de los controles deslizantes

*/

async function updateFromSliders() {

  // Inicialza un array con las características de la melodía actual
  zArray = actualMelody_z.arraySync()[0]
  const z = JSON.parse(JSON.stringify(zArray));

  // Actualiza el array con las nuevas características
  const newSliders = sliders.querySelectorAll('input');
  for (let i = 0; i < N_DIMS; i++) {
    const dim = SORTED_DIMS[i];
    z[dim] = parseFloat(newSliders[i].value);
  }

  // Muetra las nuevas características en el control deslizante
  plot(z);

  // Decodifica el nuevo vector de características y hace de la melodía resultante la melodía actual
  const zTensor = mm.tf.tensor(z, [1, 256]);
  actualMelody = await model.decode(zTensor);

  // Se actualiza el visualizador de la melodía actual
  updateVisualizer();
}

/*

Actualiza el control deslizante a partir de un array que contiene nuevas características

*/

function updateSliders(z) {
  const newSliders = sliders.querySelectorAll('input');
  for (let i = 0; i < N_DIMS; i++) {
    const dim = SORTED_DIMS[i];
    newSliders[i].value = z[dim];
  }
  plot(z);
}

/*

Dibuja un vector de características en los controles deslizantes

*/

function plot(z, color='white') {

  // Ordena los datos que se deben representar
  const data = [];
  for (let i = 0; i < N_DIMS; i++) {
    const dim = SORTED_DIMS[i];
    data.push(z[dim]);
  }

  // Dibuja los datos

  const svgElement = document.getElementById('lines')
  svgElement.innerHTML = '';

  const svg = d3.select('#lines');

  const rekt = sliders.getBoundingClientRect();
  const width = rekt.width;
  const height = rekt.height;
  svg.attr('width', width+10);
  svg.attr('height', width);

  const x = d3.scaleLinear().domain([0, N_DIMS]).range([0, width]);
  const y = d3.scaleLinear().domain([-2,2]).range([height, 0]);

  function onEdge(i) { return i === 0 || i > N_DIMS; }

  const line = d3.line()
    .x((d,i) => i == 0 ? -1: x(i)-2)
    .y((d,i) => onEdge(i) ? height / 2 : y(d))
    .curve(d3.curveStep);

  svg.append('g').append('path').datum([0,...data,0])
      .style('fill', color)
      .style('stroke-opacity', 0.3)
      .style('fill-opacity', 1)
      .attr('d', line);
}
/*

Actualiza el visualizador de la melodía actual

*/

function updateVisualizer() {
  vizInput = new mm.PianoRollSVGVisualizer(
  actualMelody[0],
  document.getElementById('vizActual'),
  {noteRGB:'35,70,90', activeNoteRGB:'157, 229, 184', noteHeight:3});
}

/*

Guarda la melodía actual en la secuencia de melodías guardadas

*/

function add(){
  savedMelody = mm.sequences.concatenate([savedMelody, actualMelody[0]]);
}

/*

Genera la interpolación entre la melodía actual y la melodía inicial y la guarda
en la secuencia de melodías guardadas. Después hace de la melodía inicial la
melodía actual.

*/

async function interpolate(){

  // Obteiene los pasos de la interpolación
  interpolateSteps = parseInt(document.getElementById('interpolateText').value)

  // Genera la interpolación
  let sequences = await model.interpolate([actualMelody[0], initialMelody[0]], interpolateSteps);

  // Añade cada paso de la interpolación a la secuencia de melodías guardadas
  for (let i = 0; i < interpolateSteps; i++){
    savedMelody = mm.sequences.concatenate([savedMelody, sequences[i]]);
  }

  // Actualiza la melodía actual a la melodía inicial
  actualMelody = initialMelody;
  actualMelody_z = initialMelody_z;
  vizInput = new mm.PianoRollSVGVisualizer(
  actualMelody[0],
  document.getElementById('vizActual'),
  {noteRGB:'35,70,90', activeNoteRGB:'157, 229, 184', noteHeight:3});
  zArray = actualMelody_z.arraySync()[0]
  updateSliders(zArray)
}
