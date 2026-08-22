import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export const en = {
  nav: { browse: 'browse', search: 'search' },
  chrome: {
    publicApi: 'public api',
    checking: 'checking…',
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
    langNote: 'Switch interface language',
    rateTitle: (mins: number, auth: boolean) =>
      `GitHub API rate limit · resets in ~${mins} min${auth ? ' · authenticated' : ' · anonymous'}`,
    palette: 'Open command palette',
  },
  browse: {
    window: 'gh-scope — github explorer',
    fetching: (l: string) => `· fetching @${l}…`,
    ph: 'login, e.g. torvalds',
    open: 'open',
    request: 'request…',
    errTitle: 'request failed',
    retry: 'retry',
    emptyBody:
      'Scope out any public GitHub profile — repositories, languages, stars and momentum — straight from the REST API.',
    emptyL1: 'type one above, hit enter',
    ready: 'ready',
    quick: 'quick:',
    recent: 'recent:',
    clear: 'clear',
    repos: 'Repositories',
    earned: '★ earned on source repos',
    exportJson: 'export .json',
    filterPh: 'filter by name, description, topic…',
    filterClear: 'clear',
    sortAria: 'Sort repositories',
    sortPushed: 'recently active',
    sortStars: 'most stars',
    sortCreated: 'newest',
    sortName: 'name A→Z',
    langAria: 'Filter by language',
    langAll: 'all languages',
    hideForks: 'hide forks',
    noRepos: 'this account has no repositories yet',
    noMatch: 'nothing matches the current filters',
    reset: 'reset filters',
    apiCap: 'showing the 100 most recently pushed repositories (API page cap)',
    slashA: 'press',
    slashB: 'to search repos',
  },
  profile: {
    repos: 'repos',
    followers: 'followers',
    following: 'following',
    since: 'on GitHub since',
    spread: 'language spread',
    privateNote: (n: number) => `${n} private repo${n === 1 ? '' : 's'} visible through your token.`,
    repoWord: (n: number) => `${n} repo${n === 1 ? '' : 's'}`,
  },
  card: {
    archived: 'archived',
    fork: 'fork',
    privateB: 'private',
    copyAria: 'Copy clone URL',
    noDesc: 'no description',
    starsT: 'Stars',
    forksT: 'Forks',
    issuesT: 'Open issues',
    activeT: 'Latest activity',
    ownerT: 'Owner',
    bmAdd: 'Save to bookmarks',
    bmDel: 'Remove from bookmarks',
    readmeT: 'Open README',
    licenseT: 'License',
    sizeT: 'Size',
    watchersT: 'Watchers',
  },
  readme: {
    loading: 'Rendering markdown…',
    raw: 'view raw',
    closeAria: 'Close',
    branch: 'branch',
    deepwiki: 'deepwiki',
    deepwikiT: 'Open in DeepWiki — generated docs + ask-the-repo chat',
    gitmcp: 'gitmcp',
    gitmcpT: 'Open in GitMCP — docs as an MCP server',
    fullCard: 'open full card',
  },
  search: {
    window: 'gh-scope — universal search',
    title: 'Search GitHub',
    sub: 'combine filters the way GitHub never lets you',
    textLbl: 'query',
    textPh: 'e.g. cli, "machine learning"…',
    langLbl: 'language',
    any: 'any',
    starsLbl: 'min stars',
    starsPh: 'e.g. 1000',
    updatedLbl: 'updated',
    createdLbl: 'created',
    licLbl: 'license',
    topicLbl: 'topic',
    topicPh: 'e.g. cli',
    ownerLbl: 'owner',
    ownerPh: 'e.g. vercel',
    sortLbl: 'sort',
    sortBest: 'best match',
    sortStars: 'most stars',
    sortForks: 'most forks',
    sortUpdated: 'recently updated',
    desc: 'desc',
    asc: 'asc',
    hideForks: 'hide forks',
    hideArchived: 'hide archived',
    run: 'search',
    searching: 'searching…',
    reset: 'reset',
    results: 'repositories',
    none: 'nothing found — loosen the filters',
    prev: '← prev',
    next: 'next →',
    page: 'page',
    queryLbl: 'generated query',
    copyQ: 'copy',
    copied: 'copied',
    rateNote: 'Search API: ~10 req/min without a token, 30 with one',
    rateLimited: 'search rate limit hit — wait about a minute and retry',
    tooMany: 'over 1,000 matches — GitHub only returns the first 1,000',
    presetAny: 'any',
    presetWeek: 'week',
    presetMonth: 'month',
    presetYear: 'year',
    errTitle: 'search failed',
    retry: 'retry',
    openDetailT: 'Open repo card',
  },
  saved: {
    title: 'Saved repositories',
    note: 'stored locally · never leaves this browser',
    clearAll: 'clear all',
    confirm: 'click again to confirm',
    emptyTitle: 'Nothing saved yet',
    emptyBody: 'Tap the bookmark on any repository card and it will wait for you here. Bookmarks live in this browser only.',
    go: 'go browse profiles',
  },
  footer: {
    data: 'gh-scope · unaffiliated with GitHub · data via',
    kSearch: 'search',
    kClose: 'close',
    kStore: 'bookmarks & theme stay in this browser',
    langNote: 'Interface language',
  },
  err: {
    net: 'Network error — check your connection and try again.',
    title: 'something crashed while rendering',
    body: 'This is a client-side bug, not your data. Reloading usually fixes it.',
    reboot: 'reboot ↻',
  },
};

export type Dict = typeof en;

export const ru: Dict = {
  nav: { browse: 'обзор', search: 'поиск' },
  chrome: {
    publicApi: 'публичный api',
    checking: 'проверка…',
    toLight: 'Включить светлую тему',
    toDark: 'Включить тёмную тему',
    langNote: 'Переключить язык интерфейса',
    rateTitle: (mins: number, auth: boolean) =>
      `Лимит GitHub API · сброс через ~${mins} мин${auth ? ' · с токеном' : ' · анонимно'}`,
    palette: 'Открыть командную палитру',
  },
  browse: {
    window: 'gh-scope — обозреватель github',
    fetching: (l: string) => `· получаем @${l}…`,
    ph: 'логин, напр. torvalds',
    open: 'открыть',
    request: 'запрос…',
    errTitle: 'запрос не удался',
    retry: 'повторить',
    emptyBody:
      'Разложите по полочкам любой публичный профиль GitHub — репозитории, языки, звёзды и динамику — напрямую из REST API.',
    emptyL1: 'введите сверху и нажмите enter',
    ready: 'готово',
    quick: 'быстрый доступ:',
    recent: 'недавние:',
    clear: 'очистить',
    repos: 'Репозитории',
    earned: '★ на исходных репо',
    exportJson: 'экспорт .json',
    filterPh: 'фильтр по имени, описанию, теме…',
    filterClear: 'сброс',
    sortAria: 'Сортировка репозиториев',
    sortPushed: 'свежая активность',
    sortStars: 'больше звёзд',
    sortCreated: 'новизна',
    sortName: 'имя А→Я',
    langAria: 'Фильтр по языку',
    langAll: 'все языки',
    hideForks: 'без форков',
    noRepos: 'у этого аккаунта пока нет репозиториев',
    noMatch: 'под текущие фильтры ничего не подошло',
    reset: 'сбросить фильтры',
    apiCap: 'показаны 100 самых свежих репозиториев (лимит страницы API)',
    slashA: 'нажмите',
    slashB: 'для поиска по репо',
  },
  profile: {
    repos: 'репо',
    followers: 'подписчики',
    following: 'подписки',
    since: 'в GitHub с',
    spread: 'языковой срез',
    privateNote: (n: number) => `Через ваш токен видно ${n} приватных репо.`,
    repoWord: (n: number) => `${n} репо`,
  },
  card: {
    archived: 'архив',
    fork: 'форк',
    privateB: 'приватный',
    copyAria: 'Скопировать URL для git clone',
    noDesc: 'описание не указано',
    starsT: 'Звёзды',
    forksT: 'Форки',
    issuesT: 'Открытые issue',
    activeT: 'Последняя активность',
    ownerT: 'Владелец',
    bmAdd: 'В закладки',
    bmDel: 'Убрать из закладок',
    readmeT: 'Открыть README',
    licenseT: 'Лицензия',
    sizeT: 'Размер',
    watchersT: 'Наблюдатели',
  },
  readme: {
    loading: 'Рендерим markdown…',
    raw: 'исходник',
    closeAria: 'Закрыть',
    branch: 'ветка',
    deepwiki: 'deepwiki',
    deepwikiT: 'Открыть в DeepWiki — генеративная документация и чат по репо',
    gitmcp: 'gitmcp',
    gitmcpT: 'Открыть в GitMCP — документация как MCP-сервер',
    fullCard: 'открыть полную карточку',
  },
  search: {
    window: 'gh-scope — универсальный поиск',
    title: 'Поиск по GitHub',
    sub: 'комбинируйте фильтры так, как не даёт сам GitHub',
    textLbl: 'запрос',
    textPh: 'напр. cli, «machine learning»…',
    langLbl: 'язык',
    any: 'любой',
    starsLbl: 'мин. звёзд',
    starsPh: 'напр. 1000',
    updatedLbl: 'обновлён',
    createdLbl: 'создан',
    licLbl: 'лицензия',
    topicLbl: 'тема',
    topicPh: 'напр. cli',
    ownerLbl: 'владелец',
    ownerPh: 'напр. vercel',
    sortLbl: 'сортировка',
    sortBest: 'лучшее совпадение',
    sortStars: 'больше звёзд',
    sortForks: 'больше форков',
    sortUpdated: 'недавно обновлены',
    desc: 'по убыв.',
    asc: 'по возраст.',
    hideForks: 'без форков',
    hideArchived: 'скрыть архивные',
    run: 'искать',
    searching: 'ищем…',
    reset: 'сброс',
    results: 'репозиториев',
    none: 'ничего не нашлось — ослабьте фильтры',
    prev: '← назад',
    next: 'вперёд →',
    page: 'стр.',
    queryLbl: 'итоговый запрос',
    copyQ: 'копировать',
    copied: 'скопировано',
    rateNote: 'Search API: ~10 зап./мин без токена, 30 с токеном',
    rateLimited: 'лимит поиска исчерпан — подождите минуту и повторите',
    tooMany: 'больше 1 000 совпадений — GitHub отдаёт только первую 1 000',
    presetAny: 'когда угодно',
    presetWeek: 'за неделю',
    presetMonth: 'за месяц',
    presetYear: 'за год',
    errTitle: 'поиск не удался',
    retry: 'повторить',
    openDetailT: 'Открыть карточку репо',
  },
  saved: {
    title: 'Сохранённые репозитории',
    note: 'хранятся локально · никуда не отправляются',
    clearAll: 'очистить всё',
    confirm: 'нажмите ещё раз для подтверждения',
    emptyTitle: 'Пока ничего не сохранено',
    emptyBody: 'Нажмите закладку на любой карточке репозитория — она будет ждать вас здесь. Закладки живут только в этом браузере.',
    go: 'перейти к профилям',
  },
  footer: {
    data: 'gh-scope · не аффилирован с GitHub · данные через',
    kSearch: 'поиск',
    kClose: 'закрыть',
    kStore: 'закладки и тема остаются в этом браузере',
    langNote: 'Язык интерфейса',
  },
  err: {
    net: 'Ошибка сети — проверьте соединение и попробуйте ещё раз.',
    title: 'что-то упало при отрисовке',
    body: 'Это баг на клиенте, а не ваши данные. Перезагрузка обычно помогает.',
    reboot: 'перезапустить ↻',
  },
};

export type Lang = 'en' | 'ru';

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => undefined, t: en });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem('ghscope:lang') === 'ru' ? 'ru' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('ghscope:lang', l);
    } catch {
      /* private mode */
    }
    document.documentElement.lang = l;
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: lang === 'ru' ? ru : en }), [lang, setLang]);

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(LangCtx);
  return { lang, setLang };
}

export function useT(): Dict {
  return useContext(LangCtx).t;
}

export function useLocale(): string {
  const { lang } = useContext(LangCtx);
  return lang === 'ru' ? 'ru-RU' : 'en-GB';
}
