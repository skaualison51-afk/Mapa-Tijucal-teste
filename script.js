// Inicializar mapa
var map = L.map('map');

var tijucalBounds = L.latLngBounds(
  L.latLng(-15.657, -56.105),
  L.latLng(-15.645, -56.090)
);

map.fitBounds(tijucalBounds);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

var ruasLayer;
var selecionado = null;

// Estilo padrão
function estiloRua(feature) {
  return { color: "red", weight: 3 };
}

function onEachRua(feature, layer) {
  layer.on('click', function () {
    if (selecionado) {
      if (selecionado.options.status === "feita") {
        selecionado.setStyle({ color:"green", weight:4 });
      } else {
        selecionado.setStyle({ color:"red", weight:3 });
      }
    }
    selecionado = layer;
    layer.setStyle({ color: "blue", weight:6 });
    layer.bindPopup(feature.properties.name || feature.properties.id).openPopup();
  });
}

function osmToGeoJSON(osmData) {
  var features = osmData.elements.map(function(el){
    if(el.type === "way" && el.geometry){
      return {
        type: "Feature",
        properties: { 
          name: el.tags && el.tags.name ? el.tags.name : null,
          id: el.tags && el.tags.__id ? el.tags.__id : el.id
        },
        geometry: {
          type: "LineString",
          coordinates: el.geometry.map(p => [p.lon, p.lat])
        }
      };
    }
  }).filter(f => f !== undefined);
  return { type: "FeatureCollection", features: features };
}

// Buscar ruas do bairro Tijucal via Overpass
fetch(`https://overpass-api.de/api/interpreter?data=
[out:json][timeout:25];
area["name"="Tijucal"]["boundary"="administrative"]->.a;
way(area.a)["highway"];
out geom;`)
.then(res => res.json())
.then(data => {
  data.elements.forEach((el, idx) => {
    el.tags = el.tags || {};
    el.tags.__id = el.id || idx;
  });

  ruasLayer = L.geoJSON(osmToGeoJSON(data), {
    style: estiloRua,
    onEachFeature: onEachRua
  }).addTo(map);

  carregarProgresso();
})
.catch(err => console.error("Erro ao carregar ruas:", err));

// Botões
function marcarFeita() {
  if (selecionado) {
    selecionado.setStyle({ color:"green", weight:4 });
    selecionado.options.status = "feita";
  } else { alert("Selecione uma rua primeiro."); }
}

function marcarFazer() {
  if (selecionado) {
    selecionado.setStyle({ color:"red", weight:3 });
    selecionado.options.status = "fazer";
  } else { alert("Selecione uma rua primeiro."); }
}

function limparSelecao() {
  if (selecionado) {
    if (selecionado.options.status === "feita") {
      selecionado.setStyle({ color:"green", weight:4 });
    } else {
      selecionado.setStyle({ color:"red", weight:3 });
    }
    selecionado = null;
  }
}

// ---------- Firebase ----------

// Salvar progresso no Firebase
function salvarProgresso() {
  if (!ruasLayer) {
    alert("Nenhuma rua carregada ainda!");
    return;
  }

  let progresso = {};
  ruasLayer.eachLayer(function(layer){
    var chave = layer.feature.properties.name || layer.feature.properties.id;
    progresso[chave] = layer.options.status || "fazer";
  });

  firebase.database().ref('progressoTijucal').set(progresso)
    .then(() => alert("✅ Progresso salvo no Firebase!"))
    .catch(err => alert("Erro ao salvar: " + err.message));
}

// Carregar progresso
function carregarProgresso() {
  firebase.database().ref('progressoTijucal').once('value')
    .then(snapshot => {
      var salvo = snapshot.val() || {};
      aplicarProgresso(salvo);
    })
    .catch(err => console.error("Erro ao carregar progresso:", err));
}

function aplicarProgresso(salvo) {
  ruasLayer.eachLayer(function(layer){
    var chave = layer.feature.properties.name || layer.feature.properties.id;
    if (salvo[chave] === "feita") {
      layer.setStyle({ color: "green", weight: 4 });
      layer.options.status = "feita";
    } else {
      layer.setStyle({ color: "red", weight: 3 });
      layer.options.status = "fazer";
    }
  });
}

// Barra de busca restrita ao bairro Tijucal
L.Control.geocoder({ defaultMarkGeocode: true, bounds: tijucalBounds }).addTo(map);
