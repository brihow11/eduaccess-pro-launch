import { useState, useEffect } from 'react';
import { X, Calendar, PhoneCall, CheckCircle } from 'lucide-react';
import { analytics } from '../services/analytics';

interface ExitIntentPopupProps {
  discoveryCallUrl: string;
  onClose: () => void;
}

export default function ExitIntentPopup({ discoveryCallUrl, onClose }: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
    analytics.trackExitPopupShown();
  }, []);

  const handleClose = (isDismissed: boolean = false) => {
    if (isDismissed) {
      analytics.trackExitPopupDismissed();
    } else {
      analytics.trackExitPopupClosed();
    }
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleCtaClick = () => {
    analytics.trackExitPopupCTAClick(discoveryCallUrl);
    window.open(discoveryCallUrl, '_blank');
    handleClose();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => handleClose(true)}
      />

      <div className={`relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full transform transition-all duration-300 ${isVisible ? 'scale-100' : 'scale-95'}`}>
        <button
          onClick={() => handleClose(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <div className="p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#094886] to-[#0A5A9E] rounded-full mb-4">
              <PhoneCall className="text-white" size={32} />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Wait! Before You Go...
            </h2>
            <p className="text-lg text-gray-600">
              Let's discuss how we can help accelerate <br />your student job placements by 58%
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="text-[#094886]" size={20} />
              Schedule a 20min Overview
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <span className="text-gray-700">
                  Discover how partner institutions achieve 58% faster placements
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <span className="text-gray-700">
                  Get a personalized roadmap for your career services program
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <span className="text-gray-700">
                  Learn proven strategies that complement your existing efforts
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <span className="text-gray-700">
                  <strong>No commitment required</strong> - just insights and value
                </span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleCtaClick}
              className="flex-1 bg-gradient-to-r from-[#094886] to-[#0A5A9E] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Calendar size={20} />
              Book Your Program Overview Call
            </button>
            <button
              onClick={() => handleClose(true)}
              className="sm:w-32 px-6 py-4 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Join partner institutions already transforming their career services
          </p>
        </div>
      </div>
    </div>
  );
}
