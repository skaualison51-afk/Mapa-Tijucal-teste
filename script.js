// script.js (module)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Substitua pelos valores do seu Supabase
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_KEY = "SUA_CHAVE_ANON";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ====== Supabase ======
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co";     // <- troque
const SUPABASE_ANON_KEY = "SEU_ANON_PUBLIC_KEY";            // <- troque
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== Mapa ======
const map = L.map("map");
const tijucalBounds = L.latLngBounds(
  L.latLng(-15.657, -56.105),
  L.latLng(-15.645, -56.090)
);
map.fitBounds(tijucalBounds);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let ruasLayer;
let selecionado = null;
// Mapa de id->layer para atualizar rápido
const camadaPorId = new Map();

function estiloRua() {
  return { color: "red", weight: 3 };
}

function pintarPorStatus(layer, status) {
  if (status === "feita") {
    layer.setStyle({ color: "green", weight: 4 });
    layer.options.status = "feita";
  } else {
    layer.setStyle({ color: "red", weight: 3 });
    layer.options.status = "fazer";
  }
}

function onEachRua(feature, layer) {
  const ruaId = feature.properties.id;
  camadaPorId.set(ruaId, layer);

  layer.on("click", () => {
    if (selecionado) {
      // restaura cor anterior da seleção
      pintarPorStatus(selecionado, selecionado.options.status || "fazer");
    }
    selecionado = layer;
    layer.setStyle({ color: "blue", weight: 6 });
    layer.bindPopup(feature.properties.name || feature.properties.id).openPopup();
  });
}

function osmToGeoJSON(osmData) {
  const features = osmData.elements
    .map((el) => {
      if (el.type === "way" && el.geometry) {
        return {
          type: "Feature",
          properties: {
            name: el.tags && el.tags.name ? el.tags.name : null,
            id: el.id
          },
          geometry: {
            type: "LineString",
            coordinates: el.geometry.map((p) => [p.lon, p.lat])
          }
        };
      }
    })
    .filter((f) => f !== undefined);

  return { type: "FeatureCollection", features };
}

// ====== Carrega vias do OSM e depois aplica progresso do Supabase ======
fetch(`https://overpass-api.de/api/interpreter?data=
[out:json][timeout:25];
area["name"="Tijucal"]["boundary"="administrative"]->.a;
way(area.a)["highway"];
out geom;`)
  .then((res) => res.json())
  .then(async (data) => {
    ruasLayer = L.geoJSON(osmToGeoJSON(data), {
      style: estiloRua,
      onEachFeature: onEachRua
    }).addTo(map);

    // Depois que as camadas existem, aplica status salvo no banco
    await carregarProgresso();
    // Habilita realtime (opcional e lindo)
    iniciarRealtime();
  })
  .catch((err) => console.error("Erro ao carregar ruas:", err));

// ====== Botões ======
document.getElementById("btnFeita").addEventListener("click", () => {
  if (!selecionado) return alert("Selecione uma rua primeiro.");
  pintarPorStatus(selecionado, "feita");
});

document.getElementById("btnFazer").addEventListener("click", () => {
  if (!selecionado) return alert("Selecione uma rua primeiro.");
  pintarPorStatus(selecionado, "fazer");
});

document.getElementById("btnLimpar").addEventListener("click", () => {
  if (!selecionado) return;
  pintarPorStatus(selecionado, selecionado.options.status || "fazer");
  selecionado = null;
});

document.getElementById("btnSalvar").addEventListener("click", salvarProgresso);

// ====== Persistência no Supabase ======
async function salvarProgresso() {
  if (!ruasLayer) return;

  const rows = [];
  ruasLayer.eachLayer((layer) => {
    const id = layer.feature.properties.id;
    const name = layer.feature.properties.name || String(id);
    const status = layer.options.status || "fazer";
    rows.push({ id, name, status });
  });

  const { error } = await supabase.from("ruas").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(error);
    alert("❌ Erro ao salvar: " + error.message);
  } else {
    alert("✅ Progresso salvo no Supabase!");
  }
}

async function carregarProgresso() {
  const { data, error } = await supabase.from("ruas").select("id, status");
  if (error) {
    console.error("Erro ao carregar progresso:", error);
    return;
  }
  const mapa = new Map(data.map((r) => [String(r.id), r.status]));
  aplicarProgresso(mapa);
}

function aplicarProgresso(mapaIdStatus) {
  ruasLayer.eachLayer((layer) => {
    const id = String(layer.feature.properties.id);
    const status = mapaIdStatus.get(id) || "fazer";
    pintarPorStatus(layer, status);
  });
}

// ====== Realtime: reflete alterações feitas por outras pessoas ao vivo ======
function iniciarRealtime() {
  const channel = supabase
    .channel("ruas-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ruas" },
      (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        const layer = camadaPorId.get(row.id);
        if (!layer) return;
        // atualiza estilo no mapa
        pintarPorStatus(layer, row.status || "fazer");
      }
    )
    .subscribe();
}

// Barra de busca restrita ao bairro Tijucal
L.Control.geocoder({ defaultMarkGeocode: true, bounds: tijucalBounds }).addTo(map);

