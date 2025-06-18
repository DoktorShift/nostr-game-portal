import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Gamepad2, Trophy, Users, LogOut, User, Wallet, Play, Plus, RefreshCw, MessageCircle, Trash2 } from 'lucide-react';
import FloatingActionMenu from '@/components/FloatingActionMenu';
import { Profile } from '@/components/Profile';
import { EnhancedFriendsSection } from '@/components/EnhancedFriendsSection';
import { PlayersOnlineSection } from '@/components/PlayersOnlineSection';
import { useNavigate } from 'react-router-dom';

interface GameHubProps {
  onLogout: () => void;
  onNavigateToProfile: () => void;
}

const games = [
  {
    id: 'nostr-tictactoe',
    name: "Nostr Tic-Tac-Toe",
    preview: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=200&fit=crop",
    maxPlayers: 2,
    comingSoon: false,
    description: "Play Tic-Tac-Toe with friends using Nostr"
  },
  {
    id: 1,
    name: "Lightning Strike",
    preview: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=200&fit=crop",
    maxPlayers: 4,
    comingSoon: true
  },
  {
    id: 2,
    name: "Nostr Puzzle",
    preview: "https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=400&h=200&fit=crop",
    maxPlayers: 8,
    comingSoon: true
  },
  {
    id: 3,
    name: "Target Master",  
    preview: "https://images.unsplash.com/photo-1485833077593-4278bba3f11f?w=400&h=200&fit=crop",
    maxPlayers: 2,
    comingSoon: true
  },
  {
    id: 4,
    name: "Arcade Classic",
    preview: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=400&h=200&fit=crop",
    maxPlayers: 1,
    comingSoon: true
  }
];

export function GameHub({ onLogout, onNavigateToProfile }: GameHubProps) {
  const [activeTab, setActiveTab] = useState<'games' | 'leaderboard' | 'friends'>('games');
  const navigate = useNavigate();
  
  // Get user pubkey from localStorage or context
  const userPubkey = localStorage.getItem('userPubkey') || '';

  const handlePlayGame = (gameId: string | number) => {
    if (typeof gameId === 'string') {
      navigate(`/games/${gameId}`);
    } else {
      console.log(`Playing game ${gameId}`);
      // Game logic will be implemented later
    }
  };

  const renderGames = () => (
    <div className="p-4 pb-24">
      <h1 className="text-3xl font-bold text-deep-sea mb-6 tracking-tight">Choose Your Game</h1>
      
      {/* Online Players Section */}
      <PlayersOnlineSection userPubkey={userPubkey} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {games.map((game) => {
          const CardComponent = game.comingSoon ? 'div' : 'button';

          return (
            <CardComponent
              key={game.id}
              className={`relative group rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 text-left w-full ${
                game.comingSoon ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={() => !game.comingSoon && handlePlayGame(game.id)}
              disabled={game.comingSoon}
            >
              <img
                src={game.preview}
                alt={game.name}
                className="w-full h-48 object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              
              {game.comingSoon && (
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <Badge variant="outline" className="bg-black/50 text-white/90 border-white/30 backdrop-blur-md text-base px-5 py-2 rounded-xl">
                    Coming Soon
                  </Badge>
                </div>
              )}

              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <h3 className="text-white font-bold text-2xl drop-shadow-lg">{game.name}</h3>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5 text-white/90 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Users className="w-4 h-4" />
                    <span>{game.maxPlayers} Players</span>
                  </div>
                  
                  {!game.comingSoon && (
                    <div className="bg-gold p-3 rounded-full text-deep-sea transform transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:bg-yellow-400 shadow-lg">
                      <Play className="w-6 h-6 fill-current" />
                    </div>
                  )}
                </div>
              </div>
            </CardComponent>
          );
        })}
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="p-4 pb-24 text-center">
      <div className="mt-20">
        <Trophy className="w-16 h-16 text-gold mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-deep-sea mb-2">Leaderboard</h2>
        <p className="text-steel-blue">Coming soon! Compete with players worldwide.</p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'games':
        return renderGames();
      case 'leaderboard':
        return renderLeaderboard();
      case 'friends':
        return <EnhancedFriendsSection userPubkey={userPubkey} />;
      default:
        return renderGames();
    }
  };

  const menuOptions = [
    {
      label: "Profile",
      Icon: <User className="w-4 h-4" />,
      onClick: onNavigateToProfile,
    },
    {
      label: "Wallet (soon)",
      Icon: <Wallet className="w-4 h-4" />,
      onClick: () => {}, // Wallet is coming soon
    },
    {
      label: "Logout",
      Icon: <LogOut className="w-4 h-4" />,
      onClick: onLogout,
    },
  ];

  return (
    <div className="min-h-screen bg-background relative">
      {/* Main Content */}
      <main className="min-h-screen">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex justify-around items-center h-16 px-4">
          <Button
            variant={activeTab === 'games' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('games')}
            className={`flex-col h-12 px-6 ${
              activeTab === 'games' 
                ? 'bg-deep-sea text-white' 
                : 'text-steel-blue hover:text-deep-sea'
            }`}
          >
            <Gamepad2 className="w-5 h-5 mb-1" />
            <span className="text-xs">Games</span>
          </Button>
          
          <Button
            variant={activeTab === 'leaderboard' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-col h-12 px-6 ${
              activeTab === 'leaderboard' 
                ? 'bg-deep-sea text-white' 
                : 'text-steel-blue hover:text-deep-sea'
            }`}
          >
            <Trophy className="w-5 h-5 mb-1" />
            <span className="text-xs">Leaderboard</span>
          </Button>
          
          <Button
            variant={activeTab === 'friends' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('friends')}
            className={`flex-col h-12 px-6 ${
              activeTab === 'friends' 
                ? 'bg-deep-sea text-white' 
                : 'text-steel-blue hover:text-deep-sea'
            }`}
          >
            <Users className="w-5 h-5 mb-1" />
            <span className="text-xs">Friends</span>
          </Button>
        </div>
      </div>

      <FloatingActionMenu options={menuOptions} className="bottom-20" />
    </div>
  );
}
