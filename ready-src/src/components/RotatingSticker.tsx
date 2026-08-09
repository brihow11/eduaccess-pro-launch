import { useState, useEffect } from 'react';
import { TrendingUp, Zap, Users, Eye } from 'lucide-react';

const messages = [
  {
    text: 'Proven Student Hiring Improvement',
    icon: TrendingUp,
    gradient: 'from-green-500 to-emerald-600'
  },
  {
    text: '58% faster job placement for students',
    icon: Zap,
    gradient: 'from-blue-500 to-cyan-600'
  },
  {
    text: 'Compliments & Amplifies Career Services',
    icon: Users,
    gradient: 'from-purple-500 to-pink-600'
  }
];

export function VisitorCounter() {
  return (
    <div className="flex items-center justify-center gap-2 scale-[0.7]">
      <Eye size={21} className="text-gray-200" />
      <span className="text-[1.441rem] text-gray-200 font-medium">
        ACE Career Readiness
      </span>
    </div>
  );
}

export default function RotatingSticker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsVisible(true);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = messages[currentIndex].icon;

  return (
    <div className="scale-90">
      <div
        className={`
          bg-gradient-to-br ${messages[currentIndex].gradient}
          text-white px-4 py-3 rounded-full shadow-2xl
          transform transition-all duration-300
          hover:scale-105 cursor-default
          flex items-center gap-2
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        `}
      >
        <CurrentIcon size={20} className="flex-shrink-0" />
        <span className="font-bold text-sm whitespace-nowrap">
          {messages[currentIndex].text}
        </span>
      </div>

      <div className="flex justify-center gap-1.5 mt-2">
        {messages.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-6 bg-white'
                : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
