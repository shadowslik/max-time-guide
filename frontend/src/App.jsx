import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Overlay, ScreenStack } from './components/ScreenStack.jsx';
import LocationScreen from './screens/LocationScreen.jsx';
import AddressScreen from './screens/AddressScreen.jsx';
import TimeScreen from './screens/TimeScreen.jsx';
import TimeCustomSheet from './screens/TimeCustomSheet.jsx';
import InterestsScreen from './screens/InterestsScreen.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import ResultsScreen from './screens/ResultsScreen.jsx';
import PlaceScreen from './screens/PlaceScreen.jsx';
import RouteScreen from './screens/RouteScreen.jsx';
import CustomChainScreen from './screens/CustomChainScreen.jsx';
import NoFitScreen from './screens/NoFitScreen.jsx';
import EditSheet from './screens/EditSheet.jsx';
import HistoryScreen from './screens/HistoryScreen.jsx';

import { CITY, HISTORY } from './data/places.js';
import { rankPlaces } from './lib/planner.js';
import { searchRemote } from './lib/api.js';
import { detectColorScheme, notifyReady, onColorSchemeChange } from './lib/maxBridge.js';
import { formatDate } from './lib/format.js';

const DEFAULT_MINUTES = 120;
const DEFAULT_INTERESTS = ['history', 'arch'];

export default function App() {
  const [scheme, setScheme] = useState(detectColorScheme);

  const [stack, setStack] = useState(['location']);
  const [sheet, setSheet] = useState(null);

  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [results, setResults] = useState([]);
  const [chain, setChain] = useState(null);
  const [chains, setChains] = useState([]); // варианты цепочек под выбранные интересы
  const [searchReady, setSearchReady] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(CITY.start);
  // Подпись выбранного адреса (улица/дом) — чтобы на карте показывать её, а не город.
  const [startLabel, setStartLabel] = useState(null);
  const [mode, setMode] = useState('single');
  const [startAt, setStartAt] = useState(() => new Date());
  const [history, setHistory] = useState(HISTORY);
  // «Мой маршрут» — места, которые пользователь сам собрал в цепочку.
  const [customChain, setCustomChain] = useState([]);

  const inChain = useCallback((id) => customChain.some((p) => p.id === id), [customChain]);
  const toggleChain = useCallback((place) => {
    setCustomChain((list) =>
      list.some((p) => p.id === place.id) ? list.filter((p) => p.id !== place.id) : [...list, place],
    );
  }, []);
  const removeFromChain = useCallback((id) => {
    setCustomChain((list) => list.filter((p) => p.id !== id));
  }, []);

  const screen = stack[stack.length - 1];

  // Направление перехода задаём в самих навигационных функциях: по длине стека
  // его не угадать — replace() может и удлинять его, и укорачивать.
  const directionRef = useRef('push');
  const go = useCallback((name) => {
    directionRef.current = 'push';
    setStack((s) => [...s, name]);
  }, []);
  const back = useCallback(() => {
    directionRef.current = 'pop';
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const replace = useCallback((...names) => {
    directionRef.current = 'push';
    setStack(names);
  }, []);
  // Подменить верхний экран, сохранив всё, что под ним. Именно этого не хватало:
  // подбор раньше затирал стек целиком, и с результатов некуда было вернуться.
  const swap = useCallback((name) => {
    directionRef.current = 'push';
    setStack((s) => [...s.slice(0, -1), name]);
  }, []);

  useEffect(() => {
    notifyReady();
    return onColorSchemeChange(setScheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);

  // Предпросмотр для шторки «Изменить подбор»: пересчитываем уже загруженные
  // с бэка места под новое время/интересы — без нового запроса.
  const preview = useMemo(
    () => rankPlaces(results, minutes, interests, start),
    [results, minutes, interests, start],
  );

  const runSearch = useCallback(
    (nextMinutes = minutes, nextInterests = interests) => {
      setMinutes(nextMinutes);
      setInterests(nextInterests);
      setStartAt(new Date());
      setMode('single');
      setSheet(null);
      setSearchReady(false);
      // Повторный подбор подменяет текущий экран, первый — добавляется поверх.
      setStack((s) => {
        const top = s[s.length - 1];
        directionRef.current = 'push';
        return ['loading', 'results', 'nofit'].includes(top) ? [...s.slice(0, -1), 'loading'] : [...s, 'loading'];
      });

      searchRemote(nextMinutes, nextInterests, start)
        .then(({ places, chain: nextChain, chains: nextChains }) => {
          setResults(places);
          setChain(nextChain);
          setChains(nextChains ?? []);
          setSelectedId(places.find((p) => p.eval.status !== 'no')?.id ?? places[0]?.id ?? null);
        })
        .catch(() => {
          setResults([]);
          setChain(null);
          setChains([]);
          setSelectedId(null);
        })
        .finally(() => setSearchReady(true));
    },
    [minutes, interests, start],
  );

  const toggleInterest = (id) =>
    setInterests((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const selected = useMemo(
    () => results.find((p) => p.id === selectedId) ?? results[0] ?? null,
    [results, selectedId],
  );

  const saveTrip = useCallback((place) => {
    const date = formatDate(new Date());
    setHistory((list) => {
      if (list.some((trip) => trip.placeId === place.id && trip.date === date)) return list;
      return [
        {
          id: `trip-${place.id}-${date}`,
          city: CITY.name,
          place: place.name,
          placeId: place.id,
          date,
          minutes: place.eval.total,
          walkTo: place.walkTo,
          visit: place.eval.visit,
          walkBack: place.walkBack,
          interests: place.interests,
        },
        ...list,
      ];
    });
  }, []);

  const openRoute = useCallback(
    (place) => {
      setSelectedId(place.id);
      saveTrip(place);
      go('route');
    },
    [go, saveTrip],
  );

  // Повтор поездки из истории: заново ищем места на бэке под её время и
  // интересы и открываем результаты (путь назад ведёт к карте, а не в тупик).
  const repeatTrip = useCallback(
    (trip) => {
      const nextMinutes = Math.min(240, Math.max(15, trip.minutes || minutes));
      const nextInterests = trip.interests?.length ? trip.interests : interests;

      setMinutes(nextMinutes);
      setInterests(nextInterests);
      setStartAt(new Date());
      setMode('single');
      setSheet(null);
      setSearchReady(false);
      directionRef.current = 'push';
      replace('location', 'results', 'loading');

      searchRemote(nextMinutes, nextInterests, start)
        .then(({ places, chain: nextChain, chains: nextChains }) => {
          setResults(places);
          setChain(nextChain);
          setChains(nextChains ?? []);
          setSelectedId(places.find((p) => p.eval.status !== 'no')?.id ?? places[0]?.id ?? null);
        })
        .catch(() => {
          setResults([]);
          setChain(null);
          setChains([]);
          setSelectedId(null);
        })
        .finally(() => setSearchReady(true));
    },
    [interests, start, minutes, replace],
  );

  const fitsCount = results.filter((p) => p.eval.status !== 'no').length;
  const nearest = useMemo(
    () => [...results].sort((a, b) => a.eval.road - b.eval.road)[0] ?? null,
    [results],
  );

  const body = () => {
    switch (screen) {
      case 'time':
        return (
          <TimeScreen
            minutes={minutes}
            onPick={setMinutes}
            onNext={() => go('interests')}
            onCustom={() => setSheet('timeCustom')}
            onBack={back}
          />
        );

      case 'interests':
        return (
          <InterestsScreen
            minutes={minutes}
            selected={interests}
            onToggle={toggleInterest}
            onAny={() => setInterests([])}
            onSubmit={() => runSearch(minutes, interests)}
            onBack={back}
          />
        );

      case 'loading':
        return (
          <LoadingScreen
            theme={scheme}
            origin={startLabel?.title || `${CITY.name}, ${CITY.district}`}
            minutes={minutes}
            interests={interests}
            found={results.length}
            fits={fitsCount}
            ready={searchReady}
            onDone={() => swap(fitsCount ? 'results' : 'nofit')}
          />
        );

      case 'results':
        return (
          <ResultsScreen
            theme={scheme}
            start={start}
            origin={startLabel?.title || `${CITY.name}, ${CITY.district}`}
            minutes={minutes}
            interests={interests}
            results={results}
            selected={selected}
            chain={chain}
            chains={chains}
            mode={mode}
            startAt={startAt}
            onSelect={setSelectedId}
            onOpenPlace={() => go('place')}
            onMarkerOpen={(id) => { setSelectedId(id); go('place'); }}
            myList={customChain}
            inMy={inChain}
            onToggleMy={toggleChain}
            onRemoveMy={removeFromChain}
            onRoute={() => selected && openRoute(selected)}
            onEdit={() => setSheet('edit')}
            onMode={setMode}
            onBack={back}
          />
        );

      case 'place':
        return (
          <PlaceScreen
            place={selected}
            minutes={minutes}
            chain={chain}
            inMyChain={selected ? inChain(selected.id) : false}
            onToggleMyChain={() => selected && toggleChain(selected)}
            onBack={back}
            onRoute={() => openRoute(selected)}
            onChain={() => {
              setMode('chain');
              back();
            }}
          />
        );

      case 'route':
        return (
          <RouteScreen
            theme={scheme}
            start={start}
            place={selected}
            minutes={minutes}
            startAt={startAt}
            onBack={back}
            onEdit={() => setSheet('edit')}
          />
        );

      case 'custom':
        return (
          <CustomChainScreen
            theme={scheme}
            start={start}
            minutes={minutes}
            startAt={startAt}
            chain={customChain}
            onRemove={removeFromChain}
            onBack={back}
          />
        );

      case 'nofit':
        return (
          <NoFitScreen
            minutes={minutes}
            interests={interests}
            nearest={nearest}
            suggestion={rankPlaces(results, minutes + 30, interests, start).filter((p) => p.eval.status !== 'no').length}
            onAddTime={() => runSearch(minutes + 30, interests)}
            onEditInterests={back}
            onShowAnyway={() => swap('results')}
            onBack={back}
          />
        );

      case 'address':
        return (
          <AddressScreen
            onPick={(item) => {
              setStart(item.coords);
              setStartLabel({ title: item.title, subtitle: item.subtitle });
              back();
            }}
            onBack={back}
          />
        );

      case 'history':
        return (
          <HistoryScreen
            history={history}
            onBack={back}
            onRepeat={repeatTrip}
            onOpen={repeatTrip}
          />
        );

      case 'location':
      default:
        return (
          <LocationScreen
            theme={scheme}
            start={start}
            label={startLabel}
            onConfirm={(coords, lbl) => {
              // Подпись места (выбранный адрес или определённое по координатам)
              // несём дальше, чтобы шаги 2–3 показывали её, а не всегда «Казань».
              setStart(coords);
              setStartLabel(lbl ? { title: lbl.title, subtitle: lbl.subtitle } : null);
              go('time');
            }}
            onAddress={() => go('address')}
            onHistory={() => go('history')}
          />
        );
    }
  };

  return (
      <div className="app">
        <ScreenStack screenKey={screen} direction={directionRef.current}>
          {body()}
        </ScreenStack>

        <Overlay active={sheet === 'timeCustom'}>
          <TimeCustomSheet
            minutes={minutes}
            startAt={startAt}
            onApply={(value) => {
              setMinutes(value);
              setSheet(null);
              if (screen === 'results' || screen === 'route') runSearch(value, interests);
            }}
            onClose={() => setSheet(null)}
          />
        </Overlay>

        <Overlay active={sheet === 'edit'}>
          <EditSheet
            minutes={minutes}
            interests={interests}
            results={preview}
            onPickTime={setMinutes}
            onCustom={() => setSheet('timeCustom')}
            onToggleInterest={toggleInterest}
            onApply={() => runSearch(minutes, interests)}
            onReset={() => {
              setMinutes(DEFAULT_MINUTES);
              setInterests(DEFAULT_INTERESTS);
            }}
            onClose={() => setSheet(null)}
          />
        </Overlay>
      </div>
  );
}
