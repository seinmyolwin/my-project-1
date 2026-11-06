import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Search,
  Shield,
  Layers,
  AlertCircle
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';

interface ManageLeaguesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedLeague?: string;
}

export const ManageLeaguesModal: React.FC<ManageLeaguesModalProps> = ({
  isOpen,
  onClose,
  initialSelectedLeague
}) => {
  const {
    settings,
    leagues,
    addLeague,
    updateLeague,
    deleteLeague,
    addTeamToLeague,
    updateTeamInLeague,
    deleteTeamFromLeague,
    resetLeaguesToDefault
  } = useFootball();

  const isMyanmar = settings.language === 'my';

  // Selected League ID
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(() => {
    if (initialSelectedLeague) {
      const found = leagues.find(
        l => l.id === initialSelectedLeague || l.name.toLowerCase() === initialSelectedLeague.toLowerCase()
      );
      if (found) return found.id;
    }
    return leagues[0]?.id || '';
  });

  // League search
  const [leagueSearch, setLeagueSearch] = useState('');
  // Team search
  const [teamSearch, setTeamSearch] = useState('');

  // New League input
  const [newLeagueName, setNewLeagueName] = useState('');
  // Editing League state
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editingLeagueName, setEditingLeagueName] = useState('');

  // New Team input
  const [newTeamName, setNewTeamName] = useState('');
  // Editing Team state
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [editingTeamNewVal, setEditingTeamNewVal] = useState('');

  // Active selected league object
  const currentLeague = useMemo(() => {
    return leagues.find(l => l.id === selectedLeagueId) || leagues[0];
  }, [leagues, selectedLeagueId]);

  // Filtered leagues
  const filteredLeagues = useMemo(() => {
    if (!leagueSearch.trim()) return leagues;
    return leagues.filter(l =>
      l.name.toLowerCase().includes(leagueSearch.toLowerCase().trim())
    );
  }, [leagues, leagueSearch]);

  // Filtered teams in active league
  const filteredTeams = useMemo(() => {
    if (!currentLeague) return [];
    if (!teamSearch.trim()) return currentLeague.teams;
    return currentLeague.teams.filter(t =>
      t.toLowerCase().includes(teamSearch.toLowerCase().trim())
    );
  }, [currentLeague, teamSearch]);

  if (!isOpen) return null;

  const handleAddLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    const created = addLeague(newLeagueName.trim());
    setNewLeagueName('');
    if (created) setSelectedLeagueId(created.id);
  };

  const handleSaveLeagueName = (id: string) => {
    if (!editingLeagueName.trim()) return;
    updateLeague(id, editingLeagueName.trim());
    setEditingLeagueId(null);
  };

  const handleDeleteLeague = (id: string, name: string) => {
    if (leagues.length <= 1) {
      alert(isMyanmar ? 'အနည်းဆုံး လိဂ် ၁ ခု ရှိရပါမည်' : 'At least one league must remain');
      return;
    }
    if (window.confirm(isMyanmar ? `"${name}" လိဂ်နှင့် ပါဝင်သော အသင်းများအားလုံးကို ဖျက်ရန် သေချာပါသလား?` : `Delete league "${name}"?`)) {
      deleteLeague(id);
      if (selectedLeagueId === id) {
        const next = leagues.find(l => l.id !== id);
        if (next) setSelectedLeagueId(next.id);
      }
    }
  };

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !currentLeague) return;
    addTeamToLeague(currentLeague.id, newTeamName.trim());
    setNewTeamName('');
  };

  const handleSaveTeamName = (oldName: string) => {
    if (!editingTeamNewVal.trim() || !currentLeague) return;
    updateTeamInLeague(currentLeague.id, oldName, editingTeamNewVal.trim());
    setEditingTeamName(null);
  };

  const handleDeleteTeam = (team: string) => {
    if (!currentLeague) return;
    if (window.confirm(isMyanmar ? `"${team}" အသင်းကို ဖျက်ရန် သေချာပါသလား?` : `Remove team "${team}"?`)) {
      deleteTeamFromLeague(currentLeague.id, team);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm(isMyanmar ? 'မူလလိဂ်များနှင့် အသင်းများကို ပြန်လည်သတ်မှတ်မည် သေချာပါသလား? လက်ရှိပြင်ထားသည်များ ပျက်သွားပါမည်။' : 'Reset all leagues and teams to default presets?')) {
      resetLeaguesToDefault();
    }
  };

  const totalTeamsCount = leagues.reduce((acc, l) => acc + l.teams.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>{isMyanmar ? 'လိဂ်များနှင့် အသင်းများ စီမံခန့်ခွဲမှု' : 'Manage Leagues & Teams'}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
                  {leagues.length} {isMyanmar ? 'လိဂ်' : 'leagues'} · {totalTeamsCount} {isMyanmar ? 'သင်း' : 'teams'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isMyanmar
                  ? 'ပွဲစဉ်ထည့်ရာတွင် အသုံးပြုမည့် လိဂ်နှင့် အသင်းများကို စိတ်ကြိုက် ဖြတ်၊ ထည့်၊ ပြင်ဆင်နိုင်ပါသည်'
                  : 'Add, edit, or remove leagues and football clubs in the dropdown lists'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two-column master-detail layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden min-h-[420px]">
          {/* Left Column: Leagues List (5 cols) */}
          <div className="md:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50/40">
            {/* Add League Form */}
            <div className="p-3.5 border-b border-slate-200 bg-white space-y-2">
              <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">
                {isMyanmar ? 'လိဂ်အသစ် ထည့်သွင်းရန်' : 'Add New League'}
              </label>
              <form onSubmit={handleAddLeague} className="flex gap-2">
                <input
                  type="text"
                  placeholder={isMyanmar ? 'ဥပမာ- Italian Serie A...' : 'League name...'}
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 bg-white"
                />
                <button
                  type="submit"
                  className="px-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer shrink-0 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'ထည့်' : 'Add'}</span>
                </button>
              </form>

              {/* League Filter */}
              <div className="relative pt-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={isMyanmar ? 'လိဂ် ရှာရန်...' : 'Search leagues...'}
                  value={leagueSearch}
                  onChange={(e) => setLeagueSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-[11px] rounded-lg border border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Leagues Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredLeagues.map((league) => {
                const isSelected = league.id === selectedLeagueId;
                const isEditing = editingLeagueId === league.id;

                return (
                  <div
                    key={league.id}
                    onClick={() => {
                      if (!isEditing) setSelectedLeagueId(league.id);
                    }}
                    className={`group px-3 py-2.5 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-100'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingLeagueName}
                          onChange={(e) => setEditingLeagueName(e.target.value)}
                          className="flex-1 h-7 px-2 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveLeagueName(league.id);
                            if (e.key === 'Escape') setEditingLeagueId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveLeagueName(league.id)}
                          className="p-1 bg-emerald-700 text-white rounded hover:bg-emerald-800"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLeagueId(null)}
                          className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 truncate">
                          <span>{league.name}</span>
                          <span
                            className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                              isSelected
                                ? 'bg-emerald-700 text-emerald-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {league.teams.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLeagueId(league.id);
                              setEditingLeagueName(league.name);
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              isSelected ? 'hover:bg-emerald-700 text-white' : 'hover:bg-slate-200 text-slate-500'
                            }`}
                            title="လိဂ်အမည် ပြင်ဆင်မည်"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLeague(league.id, league.name);
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              isSelected ? 'hover:bg-rose-600 text-rose-100' : 'hover:bg-rose-100 text-rose-500'
                            }`}
                            title="လိဂ် ဖျက်မည်"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {filteredLeagues.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {isMyanmar ? 'လိဂ် ရှာမတွေ့ပါ' : 'No leagues found'}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Teams in Selected League (7 cols) */}
          <div className="md:col-span-7 flex flex-col bg-white">
            {currentLeague ? (
              <>
                {/* Team Header & Add Team Form */}
                <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">
                        {isMyanmar ? 'ရွေးချယ်ထားသော လိဂ်' : 'Selected League'}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span>{currentLeague.name}</span>
                        <span className="text-xs font-normal text-slate-500">
                          ({currentLeague.teams.length} {isMyanmar ? 'သင်း' : 'teams'})
                        </span>
                      </h4>
                    </div>

                    <div className="w-44 relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder={isMyanmar ? 'အသင်း ရှာရန်...' : 'Filter teams...'}
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-2.5 text-xs rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>

                  {/* Add Team Input */}
                  <form onSubmit={handleAddTeam} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={isMyanmar ? `"${currentLeague.name}" ထဲသို့ အသင်းသစ် ထည့်ရန်...` : 'Add new club to this league...'}
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 bg-white"
                    />
                    <button
                      type="submit"
                      className="px-4 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isMyanmar ? 'အသင်းထည့်မည်' : 'Add Team'}</span>
                    </button>
                  </form>
                </div>

                {/* Teams Grid List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {filteredTeams.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredTeams.map((team) => {
                        const isEditingThisTeam = editingTeamName === team;

                        return (
                          <div
                            key={team}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 flex items-center justify-between gap-2 text-xs transition-all shadow-2xs"
                          >
                            {isEditingThisTeam ? (
                              <div className="flex-1 flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingTeamNewVal}
                                  onChange={(e) => setEditingTeamNewVal(e.target.value)}
                                  className="flex-1 h-7 px-2 text-xs rounded border border-slate-300"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTeamName(team);
                                    if (e.key === 'Escape') setEditingTeamName(null);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveTeamName(team)}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTeamName(null)}
                                  className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-bold text-slate-800 truncate flex-1">
                                  {team}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTeamName(team);
                                      setEditingTeamNewVal(team);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                                    title="အသင်းအမည် ပြင်ဆင်မည်"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTeam(team)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                    title="ဤအသင်းအား ဖျက်မည်"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <Shield className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                      <p className="text-xs font-medium">
                        {isMyanmar
                          ? 'ဤလိဂ်တွင် အသင်းများ မရှိသေးပါ။ အပေါ်ရှိ အကွက်မှ အသင်းသစ် ထည့်သွင်းနိုင်ပါသည်'
                          : 'No teams in this league. Use the field above to add teams.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-slate-400 text-xs">
                {isMyanmar ? 'လိဂ် တစ်ခုကို ရွေးချယ်ပါ' : 'Select a league on the left'}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-200 flex items-center gap-1.5 font-bold transition-colors cursor-pointer"
            title="စနစ်မူလ လိဂ်နှင့် အသင်းများကို ပြန်ထားမည်"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'မူလလိဂ်/အသင်းများ ပြန်ထားမည်' : 'Reset to Defaults'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              {isMyanmar ? 'ပြီးပါပြီ (ပိတ်မည်)' : 'Done (Close)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
