// 🔑 Configuração do Supabase
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_KEY = "SUA_CHAVE_ANON";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variáveis globais
let map = L.map("map").setView([-15.601, -56.097], 14);
let ruasLayer;
let ruaSelecionada = null;

// Adiciona mapa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
}).addTo(map);

// Exemplo de ruas (substitua pelo GeoJSON real do bairro)
const ruasGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Rua A" },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-56.097, -15.601],
          [-56.095, -15.602]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Rua B" },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-56.098, -15.603],
          [-56.096, -15.604]
        ]
      }
    }
  ]
};

// Estilo inicial das ruas
function estiloRuas(feature) {
  return { color: "red", weight: 3, status: "fazer" };
}

// Ao clicar na rua
function onEachRua(feature, layer) {
  layer.on("click", function() {
    if (ruaSelecionada) {
      ruasLayer.resetStyle(ruaSelecionada);
    }
    ruaSelecionada = layer;
    layer.setStyle({ color: "blue", weight: 5 });
  });
}

ruasLayer = L.geoJSON(ruasGeoJSON, {
  style: estiloRuas,
  onEachFeature: onEachRua
}).addTo(map);

// Funções de controle
function marcarFeita() {
  if (ruaSelecionada) {
    ruaSelecionada.setStyle({ color: "green", weight: 4 });
    ruaSelecionada.options.status = "feita";
  }
}

function marcarFazer() {
  if (ruaSelecionada) {
    ruaSelecionada.setStyle({ color: "red", weight: 3 });
    ruaSelecionada.options.status = "fazer";
  }
}

function limparSelecao() {
  if (ruaSelecionada) {
    ruasLayer.resetStyle(ruaSelecionada);
    ruaSelecionada = null;
  }
}

// 💾 Salvar no Supabase
async function salvarProgresso() {
  let progresso = [];

  ruasLayer.eachLayer(function(layer) {
    let nome = layer.feature.properties.name;
    let status = layer.options.status || "fazer";
    progresso.push({ nome, status });
  });

  // Limpa e reinsere os dados
  await supabaseClient.from("ruas").delete().neq("id", 0);
  let { error } = await supabaseClient.from("ruas").insert(progresso);

  if (error) {
    console.error("Erro ao salvar:", error);
    alert("Erro ao salvar progresso!");
  } else {
    alert("✅ Progresso salvo com sucesso!");
  }
}

// 📥 Carregar do Supabase
async function carregarProgresso() {
  let { data, error } = await supabaseClient.from("ruas").select("*");

  if (error) {
    console.error("Erro ao carregar:", error);
    return;
  }

  ruasLayer.eachLayer(function(layer) {
    let nome = layer.feature.properties.name;
    let rua = data.find(r => r.nome === nome);

    if (rua) {
      if (rua.status === "feita") {
        layer.setStyle({ color: "green", weight: 4 });
        layer.options.status = "feita";
      } else {
        layer.setStyle({ color: "red", weight: 3 });
        layer.options.status = "fazer";
      }
    }
  });
}

// Chama carregar ao abrir
carregarProgresso();

