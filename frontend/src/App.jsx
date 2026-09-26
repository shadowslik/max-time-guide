import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Overlay, ScreenStack } from './components/ScreenStack.jsx';
import LocationScreen from './screens/LocationScreen.jsx';
import TimeScreen from './screens/TimeScreen.jsx';
import TimeCustomSheet from './screens/TimeCustomSheet.jsx';
import InterestsScreen from './screens/InterestsScreen.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import ResultsScreen from './screens/ResultsScreen.jsx';
import PlaceScreen from './screens/PlaceScreen.jsx';
import RouteScreen from './screens/RouteScreen.jsx';
import NoFitScreen from './screens/NoFitScreen.jsx';
import EditSheet from './screens/EditSheet.jsx';
import HistoryScreen from './screens/HistoryScreen.jsx';

import { CITY, HISTORY, PLACES, TIME_OPTIONS } from './data/places.js';
import { BUFFER, buildChain, pickPlaces } from './lib/planner.js';
import { walkMinutes } from './lib/geo.js';
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
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(CITY.start);
  const [mode, setMode] = useState('single');
  const [startAt, setStartAt] = useState(() => new Date());
  const [history, setHistory] = useState(HISTORY);

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

  useEffect(() => {
    notifyReady();
    return onColorSchemeChange(setScheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);

  // Предварительный подбор под текущие параметры — нужен шторке «Изменить подбор»,
  // чтобы кнопка сразу показывала, сколько мест получится.
  const preview = useMemo(() => pickPlaces(minutes, interests, start), [minutes, interests, start]);

  const runSearch = useCallback(
    (nextMinutes = minutes, nextInterests = interests) => {
      setMinutes(nextMinutes);
      setInterests(nextInterests);
      setStartAt(new Date());
      const found = pickPlaces(nextMinutes, nextInterests, start);
      setResults(found);
      setChain(buildChain(nextMinutes, nextInterests, start));
      setSelectedId(found.find((p) => p.eval.status !== 'no')?.id ?? found[0]?.id ?? null);
      setMode('single');
      setSheet(null);
      replace('loading');
    },
    [minutes, interests, start, replace],
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

  // Повтор поездки восстанавливает её собственные условия: берём бюджет,
  // в который место реально укладывается, иначе маршрут покажет «запас 0».
  const repeatTrip = useCallback(
    (trip) => {
      const place = PLACES.find((p) => p.id === trip.placeId);
      if (!place) return;

      const walk = walkMinutes(start, place.coords);
      const needed = walk * 2 + place.idealVisit + BUFFER;
      const option = TIME_OPTIONS.find((o) => o.minutes >= needed);
      const nextMinutes = option ? option.minutes : Math.ceil(needed / 15) * 15;
      const nextInterests = trip.interests?.length ? trip.interests : interests;

      setMinutes(nextMinutes);
      setInterests(nextInterests);
      setStartAt(new Date());
      setResults(pickPlaces(nextMinutes, nextInterests, start));
      setChain(buildChain(nextMinutes, nextInterests, start));
      setSelectedId(place.id);
      replace('results', 'route');
    },
    [interests, start, replace],
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
            minutes={minutes}
            interests={interests}
            found={results.length}
            fits={fitsCount}
            onDone={() => replace('interests', fitsCount ? 'results' : 'nofit')}
          />
        );

      case 'results':
        return (
          <ResultsScreen
            theme={scheme}
            start={start}
            minutes={minutes}
            interests={interests}
            results={results}
            selected={selected}
            chain={chain}
            mode={mode}
            startAt={startAt}
            onSelect={setSelectedId}
            onOpenPlace={() => go('place')}
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

      case 'nofit':
        return (
          <NoFitScreen
            minutes={minutes}
            interests={interests}
            nearest={nearest}
            suggestion={pickPlaces(minutes + 30, interests).filter((p) => p.eval.status !== 'no').length}
            onAddTime={() => runSearch(minutes + 30, interests)}
            onEditInterests={() => replace('location', 'time', 'interests')}
            onShowAnyway={() => replace('interests', 'results')}
            onBack={() => replace('location', 'time')}
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
            onConfirm={(coords) => {
              setStart(coords);
              go('time');
            }}
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
