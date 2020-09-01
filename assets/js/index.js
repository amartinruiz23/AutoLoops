const N_DIMS = 90;

const MELODY_DIMS = [73,135,230,177,38,208,172,56,212,211,140,142,150,1,202,74,33,187,206,14,154,2,31,32,244,24,183,173,64,3,108,196,132,29,75,156,131,26,237,164,200,48,218,44,113,167,250,166,90,77,23,185,246,180,217,10,111,213,46,127,216,117,128,16,222,243,240,233,70,9,88,236,179,40,94,4,182,241,78,165,125,25,103,81,66,83,91,124,105,226,247,145,68,238,69,47,254,153,119,5,255,170,158,176,84,225,186,43,99,245,224,168,45,160,63,49,37,61,35,101,141,41,248,209,134,149,147,30,110,188,118,52,67,133,92,95,126,112,15,93,157,107,55,60,130,235,231,6,123,171,114,20,139,162,199,86,51,120,227,85,152,178,80,184,39,215,22,138,192,57,155,252,198,13,50,181,8,121,148,193,204,36,251,219,0,97,220,229,109,21,194,159,72,122,146,87,42,102,189,65,115,253,19,163,201,207,137,100,27,242,34,203,129,210,11,54,232,12,28,98,71,18,205,17,79,249,197,221,223,234,106,76,175,239,136,53,58,89,191,82,190,59,62,174,214,96,161,195,151,116,143,7,104,169,144,228];

init();

var initialMelody;
var actualMelody;
var actualMelody_z;
var tempo = 120;

function init() {
  var fileBtn = document.getElementById('fileBtn')
  fileBtn.addEventListener('change', loadFile);

  var playBtn = document.getElementById('playBtn')
  playBtn.addEventListener('click', play);
}

const model = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_small');
model.initialize()
    .then(function(MusicVAE) {
        console.log('initialized!');
    });
const player = new mm.Player();

async function play(){
  mm.Player.tone.context.resume();
  player.setTempo(tempo);
  player.start(actualMelody[0]);
}

async function loadFile() {

  const promises = [];
  for (let i = 0; i < fileInput.files.length; i++) {
    promises.push(mm.blobToNoteSequence(fileInput.files[i]));
  }
  samples = await Promise.all(promises);
  initialMelody = actualMelody = samples[0];
  actualMelody_z = await model.encode(setMelody(actualMelody));
  actualMelody = await model.decode(actualMelody_z);
}

function setMelody(mel) {
  let chunks = [];
  let quantizedMel = mm.sequences.quantizeNoteSequence(actualMelody, 4)
  const melChunk = mm.sequences.split(mm.sequences.clone(quantizedMel), 16 * 2);
  chunks = chunks.concat(melChunk);
  return chunks;
}
