import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Shield,
  Activity,
  X,
  Settings,
  ArrowLeftRight,
  Filter,
  Search,
  SlidersHorizontal,
  BookmarkPlus
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { FootballMatch, MatchResultStatus } from '../../types';
import { ManageLeaguesModal } from './ManageLeaguesModal';
import { parseHandicapGoals } from '../../utils/footballUtils';
import { getLocalDateString } from '../../utils/moneyUtils';

// Preset popular Asian handicap values in Myanmar football markets
const HANDICAP_PRESETS = [
  '0=0 (တူတူ)',
  '0-50 (သရေ ၅၀ ရှုံး)',
  '0.5 (ဝက်နိုင်)',
  '0.5-1 (တစ်လုံး ၅၀ စား)',
  '1.0 (တစ်လုံးနိုင်)',
  '1-80 (၁ လုံး ၈၀ စား)',
  '1=1.5 (၁ ပြား ၇၀)',
  '1.5 (တစ်လုံးခွဲ)',
  '1.5-2 (နှစ်လုံး ၅၀ စား)',
  '2.0 (နှစ်လုံး)'
];

// Preset popular Over/Under goal lines
const OVER_UNDER_PRESETS = [
  '1.5 (၁ လုံးခွဲ)',
  '2.0 (၂ လုံးသရေ)',
  '2-50 (၂ လုံး ၅၀ ရှုံး)',
  '2.5 (၂ လုံးခွဲ)',
  '2.5-3 (၂ လုံးခွဲ ၃ လုံးရှုံး)',
  '3.0 (၃ လုံးသရေ)',
  '3=3.5 (၃ ပြား ၇၀)',
  '3.5 (၃ လုံးခွဲ)',
  '4.0 (၄ လုံးသရေ)'
];

// Preset water / odds
const ODDS_PRESETS = [1.80, 1.85, 1.90, 1.92, 1.95, 2.00];

export const FootballFixturesView: React.FC = () => {
  const {
    settings,
    matches,
    createMatch,
    updateMatch,
    deleteMatch,
    setMatchScore,
    settleMatches,
    slips,
    leagues,
    allTeams,
    addLeague,
    addTeamToLeague
  } = useFootball();

  const isMyanmar = settings.language === 'my';

  // League & Teams Management Modal
  const [isManageLeaguesOpen, setIsManageLeaguesOpen] = useState(false);

  // Fixture Filter / Search
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'finished'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Match Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  // Form Fields
  const [leagueName, setLeagueName] = useState('English Premier League');
  const [isCustomLeague, setIsCustomLeague] = useState(false);
  const [customLeagueName, setCustomLeagueName] = useState('');

  const [homeTeam, setHomeTeam] = useState('');
  const [isCustomHome, setIsCustomHome] = useState(false);
  const [customHomeTeam, setCustomHomeTeam] = useState('');

  const [awayTeam, setAwayTeam] = useState('');
  const [isCustomAway, setIsCustomAway] = useState(false);
  const [customAwayTeam, setCustomAwayTeam] = useState('');

  const [saveCustomTeamsToLeague, setSaveCustomTeamsToLeague] = useState(true);

  const [matchDate, setMatchDate] = useState(() => getLocalDateString());
  const [kickoffTime, setKickoffTime] = useState('21:00');
  const [handicapTeam, setHandicapTeam] = useState<'home' | 'away' | 'level'>('home');
  const [handicapValue, setHandicapValue] = useState('0.5 (ဝက်နိုင်)');
  const [overUnderValue, setOverUnderValue] = useState('2.5 (၂ လုံးခွဲ)');
  const [bodyOdds, setBodyOdds] = useState('');
  const [goalOdds, setGoalOdds] = useState('');
  const [matchStatus, setMatchStatus] = useState<MatchResultStatus>('upcoming');

  // Quick Score Modal
  const [scoringMatch, setScoringMatch] = useState<FootballMatch | null>(null);
  const [hScore, setHScore] = useState('0');
  const [aScore, setAScore] = useState('0');

  // Currently active league teams list for the form
  const activeFormLeagueTeams = useMemo(() => {
    const activeName = isCustomLeague ? customLeagueName.trim() : leagueName;
    const found = leagues.find(
      l => l.name.toLowerCase() === activeName.toLowerCase() || l.id === activeName
    );
    return found ? found.teams : [];
  }, [leagues, leagueName, isCustomLeague, customLeagueName]);

  // Open Add Match Modal
  const handleOpenAddModal = () => {
    setEditingMatchId(null);
    const defaultLeague = leagues[0]?.name || 'English Premier League';
    setLeagueName(defaultLeague);
    setIsCustomLeague(false);
    setCustomLeagueName('');

    const leagueTeams = leagues.find(l => l.name === defaultLeague)?.teams || [];
    setHomeTeam(leagueTeams[0] || '');
    setIsCustomHome(false);
    setCustomHomeTeam('');

    setAwayTeam(leagueTeams[1] || '');
    setIsCustomAway(false);
    setCustomAwayTeam('');

    setMatchDate(getLocalDateString());
    setKickoffTime('21:00');
    setHandicapTeam('home');
    setHandicapValue('0.5 (ဝက်နိုင်)');
    setOverUnderValue('2.5 (၂ လုံးခွဲ)');
    setBodyOdds('');
    setGoalOdds('');
    setMatchStatus('upcoming');
    setIsModalOpen(true);
  };

  // Open Edit Match Modal
  const handleOpenEditModal = (m: FootballMatch) => {
    setEditingMatchId(m.id);

    // Check if league exists in leagues list
    const foundLeague = leagues.find(
      l => l.name.toLowerCase() === m.league.toLowerCase() || l.id === m.league
    );
    if (foundLeague) {
      setLeagueName(foundLeague.name);
      setIsCustomLeague(false);
      setCustomLeagueName('');
    } else {
      setLeagueName('__custom__');
      setIsCustomLeague(true);
      setCustomLeagueName(m.league);
    }

    // Home Team
    setHomeTeam(m.homeTeam);
    setIsCustomHome(false);
    setCustomHomeTeam('');

    // Away Team
    setAwayTeam(m.awayTeam);
    setIsCustomAway(false);
    setCustomAwayTeam('');

    setMatchDate(m.matchDate);
    setKickoffTime(m.kickoffTime);
    setHandicapTeam(m.handicapTeam);
    setHandicapValue(m.handicapValue);
    setOverUnderValue(m.overUnderValue);
    setBodyOdds(m.bodyOdds ? String(m.bodyOdds) : '');
    setGoalOdds(m.goalOdds ? String(m.goalOdds) : '');
    setMatchStatus(m.status);
    setIsModalOpen(true);
  };

  // Handle Swap Teams
  const handleSwapTeams = () => {
    const tempHome = isCustomHome ? customHomeTeam : homeTeam;
    const tempIsCustomHome = isCustomHome;

    const tempAway = isCustomAway ? customAwayTeam : awayTeam;
    const tempIsCustomAway = isCustomAway;

    if (tempIsCustomAway) {
      setIsCustomHome(true);
      setCustomHomeTeam(tempAway);
      setHomeTeam('__custom__');
    } else {
      setIsCustomHome(false);
      setHomeTeam(tempAway);
      setCustomHomeTeam('');
    }

    if (tempIsCustomHome) {
      setIsCustomAway(true);
      setCustomAwayTeam(tempHome);
      setAwayTeam('__custom__');
    } else {
      setIsCustomAway(false);
      setAwayTeam(tempHome);
      setCustomAwayTeam('');
    }
  };

  // Handle Save (Create or Update Match)
  const handleSubmitMatch = (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedLeague = isCustomLeague
      ? customLeagueName.trim()
      : leagueName;

    const resolvedHome = isCustomHome
      ? customHomeTeam.trim()
      : homeTeam.trim();

    const resolvedAway = isCustomAway
      ? customAwayTeam.trim()
      : awayTeam.trim();

    if (!resolvedLeague) {
      alert(isMyanmar ? 'လိဂ် အမည် ဖြည့်စွက်ပါ' : 'Please select or enter a league');
      return;
    }

    if (!resolvedHome || !resolvedAway) {
      alert(isMyanmar ? 'အိမ်ကွင်းနှင့် အဝေးကွင်း အသင်းအမည်များ ဖြည့်စွက်ပါ' : 'Please specify both home and away teams');
      return;
    }

    if (resolvedHome.toLowerCase() === resolvedAway.toLowerCase()) {
      alert(isMyanmar ? 'အိမ်ကွင်းနှင့် အဝေးကွင်း အသင်းတူနေပါသည်' : 'Home and Away teams cannot be the same');
      return;
    }

    // Auto-save new custom league / teams if requested
    if (saveCustomTeamsToLeague) {
      if (isCustomLeague && resolvedLeague) {
        addLeague(resolvedLeague, [resolvedHome, resolvedAway]);
      } else {
        if (isCustomHome && resolvedHome) {
          addTeamToLeague(resolvedLeague, resolvedHome);
        }
        if (isCustomAway && resolvedAway) {
          addTeamToLeague(resolvedLeague, resolvedAway);
        }
      }
    }

    const parsedBodyOdds = parseFloat(bodyOdds);
    const parsedGoalOdds = parseFloat(goalOdds);
    if (isNaN(parsedBodyOdds) || parsedBodyOdds <= 0 || isNaN(parsedGoalOdds) || parsedGoalOdds <= 0) {
      alert(isMyanmar ? 'ရေကြေး (Odds) ကို မှန်ကန်စွာ ဖြည့်သွင်းပါ' : 'Please provide valid odds greater than 0');
      return;
    }

    const payload = {
      league: resolvedLeague,
      homeTeam: resolvedHome,
      awayTeam: resolvedAway,
      matchDate,
      kickoffTime,
      handicapTeam,
      handicapValue: handicapValue.trim() || '0=0 (တူတူ)',
      overUnderValue: overUnderValue.trim() || '2.5 (၂ လုံးခွဲ)',
      bodyOdds: parsedBodyOdds,
      goalOdds: parsedGoalOdds,
      status: matchStatus
    };

    if (editingMatchId) {
      updateMatch(editingMatchId, payload);
    } else {
      createMatch(payload);
    }

    setIsModalOpen(false);
    setEditingMatchId(null);
  };

  // Save Score
  const handleSaveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoringMatch) return;

    if (hScore === '' || aScore === '' || hScore.trim() === '' || aScore.trim() === '') {
      alert(isMyanmar ? 'အိမ်ကွင်းနှင့် အဝေးကွင်း ဂိုးရလဒ်များကို ပြည့်စုံစွာ ဖြည့်သွင်းပါ' : 'Please enter scores for both teams');
      return;
    }

    const hs = parseInt(hScore, 10);
    const as = parseInt(aScore, 10);
    if (isNaN(hs) || hs < 0 || isNaN(as) || as < 0) {
      alert(isMyanmar ? 'ဂိုးရလဒ်များကို မှန်ကန်စွာ ဖြည့်သွင်းပါ' : 'Please enter valid scores');
      return;
    }

    setMatchScore(scoringMatch.id, hs, as);
    setScoringMatch(null);
  };

  // Automatically settle slips whenever matches update (stale closure free)
  useEffect(() => {
    settleMatches();
  }, [matches, settleMatches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      // Status filter
      if (statusFilter === 'open' && m.status === 'finished') return false;
      if (statusFilter === 'finished' && m.status !== 'finished') return false;

      // League filter
      if (selectedLeagueFilter !== 'all') {
        if (m.league.toLowerCase() !== selectedLeagueFilter.toLowerCase()) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchStr = `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.handicapValue} ${m.overUnderValue}`.toLowerCase();
        if (!matchStr.includes(q)) return false;
      }
      return true;
    });
  }, [matches, selectedLeagueFilter, statusFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" />
            <span>{isMyanmar ? 'ဘောလုံးပွဲစဉ်များနှင့် ပေါက်ကြေးများ' : 'Football Fixtures & Asian Odds'}</span>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
              {matches.length} {isMyanmar ? 'ပွဲ' : 'matches'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {isMyanmar
              ? 'စိတ်ကြိုက် လိဂ်များ၊ အသင်းများ ရွေးချယ်/ထည့်သွင်း၍ ဘော်ဒီနှင့် ဂိုးပေါင်းပေါက်ကြေးများကို အလွယ်တကူ သတ်မှတ်ပြင်ဆင်နိုင်ပါသည်'
              : 'Add fixtures via dropdown leagues and teams, configure Asian handicaps and odds, and enter scores'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Manage Leagues & Teams button */}
          <button
            type="button"
            onClick={() => setIsManageLeaguesOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            title="လိဂ်နှင့် အသင်းများ စာရင်း စီမံခန့်ခွဲရန်"
          >
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>{isMyanmar ? 'လိဂ်/အသင်းများ စီမံမည်' : 'Manage Leagues & Teams'}</span>
            <span className="px-1.5 py-0.2 bg-white text-slate-700 rounded-md font-mono text-[10px] font-bold border border-slate-200">
              {leagues.length}
            </span>
          </button>

          {/* Add Match button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isMyanmar ? 'ပွဲစဉ်အသစ် ထည့်မည်' : 'Add Fixture'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isMyanmar ? 'အားလုံး' : 'All'} ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'open'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isMyanmar ? 'ကစားမည့်ပွဲများ' : 'Upcoming'} ({matches.filter((m) => m.status !== 'finished').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('finished')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'finished'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ပြီးဆုံးပွဲစဉ်ရလဒ်များ' : 'Finished'}</span> ({matches.filter((m) => m.status === 'finished').length})
            </button>
          </div>

          <span className="text-slate-400 font-bold hidden lg:inline">|</span>

          <span className="text-slate-500 font-bold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>{isMyanmar ? 'လိဂ်:' : 'League:'}</span>
          </span>

          <select
            value={selectedLeagueFilter}
            onChange={(e) => setSelectedLeagueFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:border-emerald-500 max-w-xs"
          >
            <option value="all">{isMyanmar ? 'လိဂ်အားလုံး (All Leagues)' : 'All Leagues'}</option>
            {leagues.map(l => (
              <option key={l.id} value={l.name}>
                {l.name} ({l.teams.length})
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={isMyanmar ? 'အသင်းအမည်ဖြင့် ရှာရန်...' : 'Search teams or odds...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs"
          />
        </div>
      </div>

      {/* Fixtures List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMatches.map((match) => (
          <div
            key={match.id}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all space-y-4"
          >
            {/* Top Bar: League & Kickoff */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl flex items-center gap-1.5 truncate max-w-[200px]">
                <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{match.league}</span>
              </span>

              <div className="flex items-center gap-2 text-slate-500 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{match.matchDate} {match.kickoffTime}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    match.status === 'finished'
                      ? 'bg-emerald-100 text-emerald-800'
                      : match.status === 'live'
                      ? 'bg-rose-100 text-rose-800 animate-pulse'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {match.status}
                </span>
              </div>
            </div>

            {/* Teams & Score Display */}
            <div className="grid grid-cols-12 items-center gap-2 py-1">
              {/* Home Team */}
              <div className="col-span-5 text-right">
                <span className="font-bold text-slate-900 block text-sm sm:text-base truncate">
                  {match.homeTeam}
                </span>
                {match.handicapTeam === 'home' && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    အကြောပေး: {match.handicapValue}
                  </span>
                )}
              </div>

              {/* Score / VS */}
              <div className="col-span-2 text-center">
                {match.status === 'finished' || match.status === 'live' ? (
                  <div className="font-mono text-lg sm:text-xl font-black text-slate-900 bg-slate-100 py-1 px-2 rounded-xl">
                    {match.homeScore ?? 0} - {match.awayScore ?? 0}
                  </div>
                ) : (
                  <span className="font-black text-slate-400 text-xs bg-slate-100 px-2.5 py-1 rounded-full">VS</span>
                )}
              </div>

              {/* Away Team */}
              <div className="col-span-5 text-left">
                <span className="font-bold text-slate-900 block text-sm sm:text-base truncate">
                  {match.awayTeam}
                </span>
                {match.handicapTeam === 'away' && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    အကြောပေး: {match.handicapValue}
                  </span>
                )}
              </div>
            </div>

            {/* Odds Strip */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-500 font-medium block text-[11px]">
                  {isMyanmar ? 'ဘော်ဒီ အကြော / ရေကြေး' : 'Handicap Body'}
                </span>
                <span className="font-bold text-slate-900">
                  {match.handicapTeam === 'home' ? match.homeTeam : match.handicapTeam === 'away' ? match.awayTeam : 'တူတူ (Level)'} {match.handicapValue} ({match.bodyOdds})
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium block text-[11px]">
                  {isMyanmar ? 'ဂိုးပေါင်း (Over / Under)' : 'Over/Under'}
                </span>
                <span className="font-bold text-slate-900">
                  {match.overUnderValue} ({match.goalOdds})
                </span>
              </div>
            </div>

            {/* Finished Match Outcome Banner */}
            {match.status === 'finished' && (() => {
              const hScore = match.homeScore ?? 0;
              const aScore = match.awayScore ?? 0;
              const totalGoals = hScore + aScore;
              const line = parseHandicapGoals(match.handicapValue);
              let homeSpread = 0;
              if (match.handicapTeam === 'home') homeSpread = -line;
              else if (match.handicapTeam === 'away') homeSpread = line;
              const diff = (hScore + homeSpread) - aScore;

              let hOutcome = 'သရေ';
              let hBadge = 'bg-slate-100 text-slate-800 border-slate-300';
              if (diff >= 0.5) {
                hOutcome = `${match.homeTeam} နိုင်`;
                hBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300';
              } else if (diff === 0.25) {
                hOutcome = `${match.homeTeam} ဝက်နိုင်`;
                hBadge = 'bg-teal-100 text-teal-900 border-teal-300';
              } else if (diff === -0.25) {
                hOutcome = `${match.awayTeam} ဝက်နိုင်`;
                hBadge = 'bg-amber-100 text-amber-900 border-amber-300';
              } else if (diff <= -0.5) {
                hOutcome = `${match.awayTeam} နိုင်`;
                hBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300';
              }

              const ouLine = parseHandicapGoals(match.overUnderValue);
              const ouDiff = totalGoals - ouLine;
              let gOutcome = 'သရေ';
              let gBadge = 'bg-slate-100 text-slate-800 border-slate-300';
              if (ouDiff >= 0.5) {
                gOutcome = 'ဂိုးပေါင်း အပေါ်ပေါက်';
                gBadge = 'bg-blue-100 text-blue-900 border-blue-300';
              } else if (ouDiff === 0.25) {
                gOutcome = 'ဂိုးပေါင်း အပေါ် ဝက်နိုင်';
                gBadge = 'bg-cyan-100 text-cyan-900 border-cyan-300';
              } else if (ouDiff === -0.25) {
                gOutcome = 'ဂိုးပေါင်း အောက် ဝက်နိုင်';
                gBadge = 'bg-indigo-100 text-indigo-900 border-indigo-300';
              } else if (ouDiff <= -0.5) {
                gOutcome = 'ဂိုးပေါင်း အောက်ပေါက်';
                gBadge = 'bg-purple-100 text-purple-900 border-purple-300';
              }

              return (
                <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-950 text-[11px]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isMyanmar ? 'ပွဲပြီးရလဒ် အဖြေ:' : 'Settled Outcome:'}</span>
                    </span>
                    <span className="font-mono text-slate-600">စုစုပေါင်း {totalGoals} ဂိုး</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-black border text-center ${hBadge}`}>
                      {hOutcome}
                    </div>
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-black border text-center ${gBadge}`}>
                      {gOutcome}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {/* Enter Score Button */}
                <button
                  type="button"
                  onClick={() => {
                    setScoringMatch(match);
                    setHScore(match.homeScore !== undefined ? String(match.homeScore) : '');
                    setAScore(match.awayScore !== undefined ? String(match.awayScore) : '');
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'ရလဒ်သွင်းမည်' : 'Score'}</span>
                </button>

                {/* Edit Fixture & Odds Button */}
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(match)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="ပေါက်ကြေးနှင့် ပွဲစဉ် အချက်အလက် ပြင်ဆင်ရန်"
                >
                  <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isMyanmar ? 'ပေါက်ကြေး/ပွဲပြင်မည်' : 'Edit Odds'}</span>
                </button>
              </div>

              {/* Delete Match Button */}
              <button
                type="button"
                onClick={() => {
                  const relatedSlips = slips.filter(s =>
                    s.status !== 'cancelled' &&
                    s.selections.some(sel => sel.matchId === match.id)
                  );
                  let confirmMsg = isMyanmar
                    ? `"${match.homeTeam} vs ${match.awayTeam}" ပွဲစဉ်ကို ဖျက်ရန် သေချာပါသလား?`
                    : 'Delete this fixture?';
                  if (relatedSlips.length > 0) {
                    confirmMsg = isMyanmar
                      ? `သတိပေးချက်: ဤပွဲစဉ်နှင့် ဆက်စပ်နေသော ဘောင်ချာ (${relatedSlips.length}) စောင် ရှိနေပါသည်။ ပွဲဖျက်လိုက်ပါက ဘောင်ချာများ pending ဖြစ်ကျန်နေမည်ဖြစ်သည်။ ဆက်လက်ဖျက်ရန် သေချာပါသလား?`
                      : `Warning: ${relatedSlips.length} active/settled vouchers are linked to this match. Deleting will leave them pending. Continue deleting?`;
                  }
                  if (window.confirm(confirmMsg)) {
                    deleteMatch(match.id);
                  }
                }}
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                title="ပွဲစဉ် ဖျက်မည်"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredMatches.length === 0 && (
          <div className="col-span-full bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              {isMyanmar ? 'ကိုက်ညီသော ပွဲစဉ် မရှိသေးပါ' : 'No fixtures found matching criteria'}
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isMyanmar ? 'ပွဲစဉ်အသစ် ထည့်သွင်းမည်' : 'Add New Fixture'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Match Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  {editingMatchId ? <Edit2 className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingMatchId
                      ? (isMyanmar ? 'ပွဲစဉ်နှင့် ပေါက်ကြေး ပြင်ဆင်ခြင်း' : 'Edit Fixture & Asian Odds')
                      : (isMyanmar ? 'ပွဲစဉ်အသစ် ထည့်သွင်းခြင်း' : 'Add Football Fixture & Odds')}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {isMyanmar
                      ? 'လိဂ်နှင့် အသင်းများကို Dropdown ဖြင့် ရွေးချယ်နိုင်ပြီး ပေါက်ကြေးစိတ်ကြိုက် သတ်မှတ်နိုင်ပါသည်'
                      : 'Select leagues/teams from dropdown and customize Asian handicap odds'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingMatchId(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitMatch} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
              {/* League Selector */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isMyanmar ? 'လိဂ် ရွေးချယ်ရန် (League)' : 'Select League'}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsManageLeaguesOpen(true)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>{isMyanmar ? 'လိဂ်/အသင်းများ စီမံမည်' : 'Manage List'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-8">
                    <select
                      value={isCustomLeague ? '__custom__' : leagueName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomLeague(true);
                          setCustomLeagueName('');
                        } else {
                          setIsCustomLeague(false);
                          setLeagueName(val);
                          // Auto update home and away teams from this league if available
                          const l = leagues.find(x => x.name === val);
                          if (l && l.teams.length >= 2) {
                            setHomeTeam(l.teams[0]);
                            setIsCustomHome(false);
                            setAwayTeam(l.teams[1]);
                            setIsCustomAway(false);
                          }
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:border-emerald-500"
                    >
                      {leagues.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.name} ({l.teams.length} {isMyanmar ? 'သင်း' : 'teams'})
                        </option>
                      ))}
                      <option value="__custom__">
                        ➕ {isMyanmar ? '+ စိတ်ကြိုက်လိဂ် အသစ်ရိုက်ထည့်မည် (Custom League)...' : '+ Type Custom League...'}
                      </option>
                    </select>
                  </div>

                  <div className="sm:col-span-4 flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomLeague(prev => !prev);
                        if (!isCustomLeague) setCustomLeagueName('');
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 font-bold text-[11px] bg-white transition-colors cursor-pointer"
                    >
                      {isCustomLeague
                        ? (isMyanmar ? 'စာရင်းမှ ပြန်ရွေးမည်' : 'Pick from list')
                        : (isMyanmar ? '+ လိဂ်အသစ် ရိုက်မည်' : '+ Custom League')}
                    </button>
                  </div>
                </div>

                {/* Custom League Input if selected */}
                {isCustomLeague && (
                  <div className="pt-1 animate-in fade-in duration-100">
                    <input
                      type="text"
                      placeholder={isMyanmar ? 'လိဂ်အမည် ရိုက်ထည့်ပါ (ဥပမာ- UEFA Europa League)...' : 'Type custom league name...'}
                      value={customLeagueName}
                      onChange={(e) => setCustomLeagueName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-emerald-400 bg-white font-bold text-slate-800 focus:border-emerald-600"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Teams Selection (Home & Away) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isMyanmar ? 'အသင်းများ ရွေးချယ်ရန် (Home vs Away)' : 'Select Teams'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleSwapTeams}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                    title="အိမ်ကွင်းနှင့် အဝေးကွင်း နေရာလဲမည်"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>{isMyanmar ? 'အိမ်/ဝေး လဲမည်' : 'Swap Teams'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Home Team */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 text-[11px]">
                      {isMyanmar ? 'အိမ်ကွင်းသင်း (Home Team)' : 'Home Team'}
                    </label>

                    {!isCustomHome ? (
                      <select
                        value={homeTeam}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomHome(true);
                            setCustomHomeTeam('');
                          } else {
                            setHomeTeam(val);
                          }
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:border-emerald-500"
                      >
                        <optgroup label={isMyanmar ? 'လက်ရှိလိဂ်မှ အသင်းများ' : 'Teams in this League'}>
                          {activeFormLeagueTeams.map((t) => (
                            <option key={`home-${t}`} value={t}>{t}</option>
                          ))}
                        </optgroup>
                        {allTeams.length > activeFormLeagueTeams.length && (
                          <optgroup label={isMyanmar ? 'အခြားလိဂ်များမှ အသင်းများ' : 'Other Registered Teams'}>
                            {allTeams
                              .filter(t => !activeFormLeagueTeams.includes(t))
                              .map((t) => (
                                <option key={`home-all-${t}`} value={t}>{t}</option>
                              ))}
                          </optgroup>
                        )}
                        <option value="__custom__">
                          ➕ {isMyanmar ? '+ စိတ်ကြိုက်အသင်း အသစ်ရိုက်မည်...' : '+ Type custom team...'}
                        </option>
                      </select>
                    ) : (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder={isMyanmar ? 'အိမ်ကွင်း အသင်းအမည်...' : 'Home team name...'}
                          value={customHomeTeam}
                          onChange={(e) => setCustomHomeTeam(e.target.value)}
                          className="flex-1 h-10 px-3 rounded-xl border border-emerald-400 bg-white font-bold"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomHome(false);
                            setHomeTeam(activeFormLeagueTeams[0] || allTeams[0] || '');
                          }}
                          className="px-2.5 h-10 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-200 text-[11px] font-bold"
                          title="စာရင်းမှ ပြန်ရွေးမည်"
                        >
                          {isMyanmar ? 'စာရင်း' : 'List'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 text-[11px]">
                      {isMyanmar ? 'အဝေးကွင်းသင်း (Away Team)' : 'Away Team'}
                    </label>

                    {!isCustomAway ? (
                      <select
                        value={awayTeam}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomAway(true);
                            setCustomAwayTeam('');
                          } else {
                            setAwayTeam(val);
                          }
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:border-emerald-500"
                      >
                        <optgroup label={isMyanmar ? 'လက်ရှိလိဂ်မှ အသင်းများ' : 'Teams in this League'}>
                          {activeFormLeagueTeams.map((t) => (
                            <option key={`away-${t}`} value={t}>{t}</option>
                          ))}
                        </optgroup>
                        {allTeams.length > activeFormLeagueTeams.length && (
                          <optgroup label={isMyanmar ? 'အခြားလိဂ်များမှ အသင်းများ' : 'Other Registered Teams'}>
                            {allTeams
                              .filter(t => !activeFormLeagueTeams.includes(t))
                              .map((t) => (
                                <option key={`away-all-${t}`} value={t}>{t}</option>
                              ))}
                          </optgroup>
                        )}
                        <option value="__custom__">
                          ➕ {isMyanmar ? '+ စိတ်ကြိုက်အသင်း အသစ်ရိုက်မည်...' : '+ Type custom team...'}
                        </option>
                      </select>
                    ) : (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder={isMyanmar ? 'အဝေးကွင်း အသင်းအမည်...' : 'Away team name...'}
                          value={customAwayTeam}
                          onChange={(e) => setCustomAwayTeam(e.target.value)}
                          className="flex-1 h-10 px-3 rounded-xl border border-emerald-400 bg-white font-bold"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomAway(false);
                            setAwayTeam(activeFormLeagueTeams[1] || allTeams[1] || '');
                          }}
                          className="px-2.5 h-10 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-200 text-[11px] font-bold"
                          title="စာရင်းမှ ပြန်ရွေးမည်"
                        >
                          {isMyanmar ? 'စာရင်း' : 'List'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Option to automatically remember custom teams */}
                {(isCustomLeague || isCustomHome || isCustomAway) && (
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveTeamsCb"
                      checked={saveCustomTeamsToLeague}
                      onChange={(e) => setSaveCustomTeamsToLeague(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="saveTeamsCb" className="text-[11px] font-bold text-slate-700 cursor-pointer flex items-center gap-1">
                      <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isMyanmar ? 'အသစ်ရိုက်ထည့်ထားသော လိဂ်နှင့် အသင်းများကို နောင်တွင် အမြဲသုံးနိုင်ရန် မှတ်သားထားမည်' : 'Save new custom leagues/teams to lists for future use'}</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Match Date, Kickoff Time, & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isMyanmar ? 'ပွဲကစားမည့် ရက်စွဲ' : 'Match Date'}
                  </label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isMyanmar ? 'စတင်ကန်မည့် အချိန်' : 'Kickoff Time'}
                  </label>
                  <input
                    type="time"
                    value={kickoffTime}
                    onChange={(e) => setKickoffTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isMyanmar ? 'အခြေအနေ' : 'Status'}
                  </label>
                  <select
                    value={matchStatus}
                    onChange={(e) => setMatchStatus(e.target.value as MatchResultStatus)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="upcoming">Upcoming (မစတင်မီ)</option>
                    <option value="live">Live (ယှဉ်ပြိုင်နေဆဲ)</option>
                    <option value="finished">Finished (ပြီးဆုံးပြီး)</option>
                    <option value="postponed">Postponed (ရွှေ့ဆိုင်း)</option>
                    <option value="void">Void (ဖျက်သိမ်း/ပွဲပျက်)</option>
                  </select>
                </div>
              </div>

              {/* Asian Handicap (ဘော်ဒီ အကြောပေါက်ကြေး စိတ်ကြိုက်သတ်မှတ်ချက်) */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{isMyanmar ? 'ဘော်ဒီ အကြောပေါက်ကြေး (Asian Handicap)' : 'Asian Handicap Setting'}</span>
                  </label>
                </div>

                {/* Handicap Team Selector */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    {isMyanmar ? 'အကြောပေးမည့် အသင်း' : 'Giving Handicap'}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setHandicapTeam('home')}
                      className={`h-9 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        handicapTeam === 'home'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{isMyanmar ? 'အိမ်ကွင်းပေး (Home)' : 'Home Gives'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandicapTeam('away')}
                      className={`h-9 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        handicapTeam === 'away'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{isMyanmar ? 'အဝေးကွင်းပေး (Away)' : 'Away Gives'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandicapTeam('level')}
                      className={`h-9 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        handicapTeam === 'level'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{isMyanmar ? 'တူတူ (Level 0=0)' : 'Level'}</span>
                    </button>
                  </div>
                </div>

                {/* Handicap Value Preset Chips + Custom Input */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-slate-600">
                    {isMyanmar ? 'အကြောပေါက်ကြေး (ကလစ်နှိပ်၍ သို့မဟုတ် စိတ်ကြိုက်ရိုက်ထည့်ပါ)' : 'Handicap Line (Click preset or type custom)'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {HANDICAP_PRESETS.map((preset) => {
                      const isSelected = handicapValue === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setHandicapValue(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    placeholder={isMyanmar ? 'စိတ်ကြိုက်အကြောပေါက်ကြေး (ဥပမာ- 1-80, 0.5, 2-50, 1=1.5)...' : 'Custom handicap value...'}
                    value={handicapValue}
                    onChange={(e) => setHandicapValue(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Over / Under (ဂိုးပေါင်း ပေါက်ကြေး စိတ်ကြိုက်သတ်မှတ်ချက်) */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-700" />
                    <span>{isMyanmar ? 'ဂိုးပေါင်း ပေါက်ကြေး (Over / Under)' : 'Over/Under Setting'}</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-slate-600">
                    {isMyanmar ? 'ဂိုးပေါင်းလိုင်း (ကလစ်နှိပ်၍ သို့မဟုတ် စိတ်ကြိုက်ရိုက်ထည့်ပါ)' : 'Over/Under Line'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {OVER_UNDER_PRESETS.map((preset) => {
                      const isSelected = overUnderValue === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setOverUnderValue(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-700 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    placeholder={isMyanmar ? 'စိတ်ကြိုက်ဂိုးပေါင်းပေါက်ကြေး (ဥပမာ- 2.5, 2.5-3, 3.0, 3=3.5)...' : 'Custom over/under value...'}
                    value={overUnderValue}
                    onChange={(e) => setOverUnderValue(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Water & Odds Rates (ရေကြေး / ပေါက်ဆ စိတ်ကြိုက်သတ်မှတ်ချက်) */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>{isMyanmar ? 'ရေကြေး / ပေါက်ဆ သတ်မှတ်ချက် (Odds Rate)' : 'Odds Rate / Water'}</span>
                  </label>

                  {/* Quick Sets for Water */}
                  <div className="flex gap-1">
                    {[1.90, 1.92, 1.95, 2.00].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setBodyOdds(String(val));
                          setGoalOdds(String(val));
                        }}
                        className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[10px] font-bold cursor-pointer"
                        title={`နှစ်ဖက်စလုံး ${val} သတ်မှတ်မည်`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isMyanmar ? 'ဘော်ဒီ ရေကြေး (Body Odds)' : 'Body Odds'}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="1.0"
                        max="5.0"
                        value={bodyOdds}
                        onChange={(e) => setBodyOdds(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono font-bold bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isMyanmar ? 'ဂိုးပေါင်း ရေကြေး (Goal Odds)' : 'Goal Odds'}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="1.0"
                        max="5.0"
                        value={goalOdds}
                        onChange={(e) => setGoalOdds(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingMatchId(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
                >
                  {isMyanmar ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingMatchId
                      ? (isMyanmar ? 'ပြင်ဆင်မှု သိမ်းဆည်းမည်' : 'Save Changes')
                      : (isMyanmar ? 'ပွဲစဉ်ထည့်သွင်းမည်' : 'Save Fixture')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enter Score Modal */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {isMyanmar ? 'ပွဲပြီးရလဒ် သွင်းခြင်း' : 'Enter Full-Time Score'}
              </h3>
              <button
                type="button"
                onClick={() => setScoringMatch(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScore} className="space-y-4">
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-700 block mb-1 truncate max-w-[100px]">
                    {scoringMatch.homeTeam}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="20"
                    value={hScore}
                    onChange={(e) => setHScore(e.target.value)}
                    onFocus={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    onClick={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    className="w-16 h-14 text-center font-mono text-2xl font-black rounded-2xl border border-slate-300 focus:border-emerald-500 bg-slate-50"
                  />
                </div>

                <span className="font-black text-slate-400 text-lg">-</span>

                <div className="text-center">
                  <span className="text-xs font-bold text-slate-700 block mb-1 truncate max-w-[100px]">
                    {scoringMatch.awayTeam}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="20"
                    value={aScore}
                    onChange={(e) => setAScore(e.target.value)}
                    onFocus={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    onClick={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    className="w-16 h-14 text-center font-mono text-2xl font-black rounded-2xl border border-slate-300 focus:border-emerald-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {isMyanmar ? 'ရလဒ်အတည်ပြုပြီး စာရင်းရှင်းမည်' : 'Confirm & Settle'}
                </button>
                <button
                  type="button"
                  onClick={() => setScoringMatch(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Leagues & Teams Modal */}
      <ManageLeaguesModal
        isOpen={isManageLeaguesOpen}
        onClose={() => setIsManageLeaguesOpen(false)}
        initialSelectedLeague={leagueName}
      />
    </div>
  );
};
