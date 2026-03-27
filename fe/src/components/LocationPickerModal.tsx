import { useState, useRef, useEffect } from 'react';
import { Modal, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';
import { View, Text, Pressable, TextInput } from '@/tw';

const DEFAULT_LAT = 10.7769;
const DEFAULT_LNG = 106.7009;

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface PickedLocation {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
  initialLat?: number;
  initialLng?: number;
  initialName?: string;
}

function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>body,html,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${lat},${lng}],15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    var marker = L.marker([${lat},${lng}],{draggable:true}).addTo(map);
    marker.on('dragend',function(){
      var p=marker.getLatLng();
      window.ReactNativeWebView.postMessage(JSON.stringify({lat:p.lat,lng:p.lng}));
    });
    window.moveMarker=function(lat,lng){
      marker.setLatLng([lat,lng]);
      map.setView([lat,lng],15);
    };
    document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);window.moveMarker(d.lat,d.lng);}catch(err){}});
    window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);window.moveMarker(d.lat,d.lng);}catch(err){}});
  </script>
</body>
</html>`;
}

export function LocationPickerModal({ visible, onClose, onConfirm, initialLat, initialLng, initialName }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentLat, setCurrentLat] = useState(DEFAULT_LAT);
  const [currentLng, setCurrentLng] = useState(DEFAULT_LNG);
  const [currentName, setCurrentName] = useState('');
  const [mapHtml, setMapHtml] = useState('');

  useEffect(() => {
    if (!visible) return;
    const lat = initialLat ?? DEFAULT_LAT;
    const lng = initialLng ?? DEFAULT_LNG;
    setCurrentLat(lat);
    setCurrentLng(lng);
    setCurrentName(initialName ?? '');
    setQuery('');
    setResults([]);
    setShowResults(false);
    setMapHtml(buildMapHtml(lat, lng));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=vi`,
          { headers: { 'User-Agent': 'TaskManagementApp/1.0' } },
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      } catch {
        // network error — ignore
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, visible]);

  function selectResult(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setCurrentLat(lat);
    setCurrentLng(lng);
    setCurrentName(result.display_name);
    setShowResults(false);
    setQuery('');
    webViewRef.current?.injectJavaScript(`window.moveMarker(${lat},${lng}); true;`);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-surface">
        {/* Header */}
        <View className="glass-effect px-5 pt-14 pb-4 flex-row items-center">
          <Pressable onPress={onClose} className="mr-3 active:opacity-60">
            <Text className="text-primary font-semibold">← Huỷ</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">
            Chọn địa điểm
          </Text>
        </View>

        {/* Search bar */}
        <View className="px-4 pt-3 pb-2">
          <View className="flex-row items-center bg-surface-container-high rounded-xl px-4 h-12">
            {searching ? (
              <ActivityIndicator size="small" style={{ marginRight: 8 }} />
            ) : (
              <Text className="text-on-surface-variant mr-2">🔍</Text>
            )}
            <TextInput
              className="flex-1 text-on-surface text-base"
              placeholder="Tìm địa điểm..."
              placeholderTextColor="#737685"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => { setQuery(''); setResults([]); setShowResults(false); }}
                className="active:opacity-60 pl-2"
              >
                <Text className="text-on-surface-variant">✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Map + Results overlay */}
        <View style={{ flex: 1 }}>
          {mapHtml ? (
            <WebView
              ref={webViewRef}
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              onMessage={(e) => {
                try {
                  const { lat, lng } = JSON.parse(e.nativeEvent.data) as { lat: number; lng: number };
                  setCurrentLat(lat);
                  setCurrentLng(lng);
                } catch {
                  // ignore malformed messages
                }
              }}
            />
          ) : null}

          {/* Search results overlay */}
          {showResults && results.length > 0 && (
            <View
              className="bg-surface-container-low rounded-xl"
              style={{ position: 'absolute', top: 0, left: 16, right: 16, zIndex: 10, elevation: 8 }}
            >
              {results.map((r, i) => (
                <Pressable
                  key={r.place_id}
                  onPress={() => selectResult(r)}
                  className={`px-4 py-3 active:bg-surface-container-high ${i < results.length - 1 ? 'border-b border-surface-container' : ''}`}
                >
                  <Text className="text-sm text-on-surface" numberOfLines={2}>{r.display_name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Bottom: selected location + confirm */}
        <View className="px-4 py-4 gap-3 bg-surface">
          {currentName ? (
            <View className="flex-row items-center bg-surface-container-high rounded-xl px-4 py-3">
              <Text className="mr-2">📍</Text>
              <Text className="flex-1 text-sm text-on-surface" numberOfLines={2}>{currentName}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => onConfirm({ name: currentName, lat: currentLat, lng: currentLng })}
            className="kinetic-gradient rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-on-primary font-bold text-base">Xác nhận vị trí</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
