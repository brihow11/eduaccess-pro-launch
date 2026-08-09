import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Square, TrendingUp, BarChart3, Clock, Video, Users, CheckCircle, Download, Calendar, Sparkles, Upload, GraduationCap, Brain, Cpu, Network, Zap, Target, BookOpen, Lightbulb, Database, Code, Microscope, Atom, Binary, Server, LogOut, X, ExternalLink, Eye, Plus, Minus } from 'lucide-react';
import EditableText from './components/EditableText';
import ProgramDetailsTable from './components/ProgramDetailsTable';
import ExitIntentPopup from './components/ExitIntentPopup';
import RotatingSticker, { VisitorCounter } from './components/RotatingSticker';
import { analytics } from './services/analytics';
import { setupVideoTracking, VideoTracker } from './utils/videoTracking';
import livePageSnapshot from './live-page-content.json';
import { createRailwayStore } from './railway-store';

const railwayStore = createRailwayStore();

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoTrackerRef = useRef<VideoTracker | null>(null);
  const [sessionStart] = useState(Date.now());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupName, setBackupName] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [hasPlayedVideo, setHasPlayedVideo] = useState(false);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [exitIntentTriggered, setExitIntentTriggered] = useState(false);
  const [hoveredStudentPain, setHoveredStudentPain] = useState<number | null>(null);
  const [hoveredProgramPain, setHoveredProgramPain] = useState<number | null>(null);
  const [painPointHoverTimer, setPainPointHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const [showMascot, setShowMascot] = useState(() => analytics.getABVariant() === 'with_mascot');

  const [content, setContent] = useState({
    siteName: 'Job Seeker Pro',
    heroTitle: 'Job Seeker Pro',
    heroSubtitle: 'ACE Career Readiness System',
    heroBenefit: 'Accelerating Student Job Placements 58% faster With a Step-by-Step Program',
    fastPlacementStat: '58%',
    studentPainPointsTitle: 'Career Services - Student Pain Points',
    studentPainPointsSubtitle: 'Students face overwhelming challenges in today\'s competitive job market',
    programPainPointsTitle: 'Career Services - Program and Staff Pain Points',
    programPainPointsSubtitle: 'Career services departments struggle with resource constraints and accountability pressures',
    solutionTitle: 'Powering Career Services to compete and win like they never thought possible!',
    solutionTagline: 'Job seekers using this program get jobs 58% faster than industry metrics',
    testimonialsTitle: 'Trusted by Education Leaders',
    testimonialsSubtitle: 'Hear from career services professionals who transformed their programs',
    ctaTitle: 'Ready to Transform Your Career Services?',
    ctaSubtitle: 'Join 50+ partner institutions already accelerating student success',
    ctaBanner: 'LIMITED TIME: First 10 institutions receive 3-month free trial',
    footerTagline: 'Empowering career services to deliver exceptional student outcomes',
    discoveryCallUrl: 'https://meetings-na2.hubspot.com/brian-howard?uuid=3d5fc893-89a0-40d3-a032-6df252dc3f75',
    webinarUrl: 'https://www.jobseeker.pro/edu',
    webinarLabel: 'Sign up for Next Webinar',
    ctaDiscoveryTitle: 'Schedule Program Overview Call',
    ctaDiscoverySubtitle: 'No commitment • 20 min call',
    ctaWebinarTitle: 'Join Next Program Overview Webinar',
    ctaWebinarSubtitle: 'Live presentation and Q&A with program experts',
    videoOverlayText: 'Watch Mini Overview',
    downloadResourcesTitle: 'Download Resources',
    meetingLinks: [
      { label: 'Schedule Discovery Call', url: 'https://calendly.com/discovery' },
      { label: 'Book Partnership Meeting', url: 'https://calendly.com/partnership' },
      { label: 'Program Demo', url: 'https://calendly.com/demo' },
      { label: 'Implementation Call', url: 'https://calendly.com/implementation' }
    ],
    webinarLinks: [
      { label: 'Partner Success Webinar', url: 'https://zoom.us/webinar1' },
      { label: 'Implementation Training', url: 'https://zoom.us/webinar2' },
      { label: 'Best Practices Workshop', url: 'https://zoom.us/webinar3' }
    ],
    downloadGuide: {
      label: 'Download program overview guide',
      url: '',
      kajabiEmbedUrl: ''
    },
    studentPainPoints: [
      'ASDF',
      'ASDF',
      'ASDF',
      'ASDF',
      'ASDF',
      'ASDF'
    ],
    programPainPoints: [
      'ASDF',
      'ASDF',
      'ASDF',
      'ASDF',
      'ASDF',
      'ASDF'
    ],
    programElements: [
      'AI-Powered Resume Optimization',
      'Interview Preparation Tools',
      'Personalized Job Matching',
      'Professional Networking Platform',
      'Career Path Assessment',
      'Skills Gap Analysis',
      'Employer Connection Portal',
      'Real-time Market Insights',
      'Application Tracking System',
      'Video Interview Practice',
      'Professional Branding Guidance',
      'Industry Mentor Matching'
    ],
    programDetailsTitle: 'Click here to see program details',
    programDetails: [
      { feature: 'Primary job', description: 'What this tier is for', essentials: 'Modern job-search system + progress visibility', core: 'Weekly practice + expert feedback + coaching attendance visibility', max: 'Max live access + faculty enablement + alumni carry-through + class shell' },
      { feature: 'BRAVE 5-Step Job Search', description: 'structured curriculum', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Tools & Templates', description: 'résumé, cover, tracker, STAR, follow-ups', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Slack Community', description: 'peer help; moderated threads', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'AI Interview Practice', description: 'practice + bring Qs to live sessions', essentials: 'included', core: 'included', max: 'included' },
      { feature: '60-min Live Orientation', description: 'cohort kickoff', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Monthly Student Progress Reporting', description: 'one-page + CSV', essentials: 'included', core: 'enhanced', max: 'enhanced' },
      { feature: 'Quarterly Strategy Call (Career Services)', description: '', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Weekly Group Coaching', description: 'live, 60-minute', essentials: 'not-included', core: 'included', max: 'enhanced' },
      { feature: 'Résumé Review + LinkedIn Review', description: '', essentials: 'not-included', core: 'included', max: 'enhanced' },
      { feature: 'Coaching Attendance Visibility', description: 'appears in reporting', essentials: 'not-included', core: 'included', max: 'included' },
      { feature: 'Office Hours (AMA-style)', description: 'Tue/Thu evenings + Sat morning', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'Bootcamps', description: '2 per academic year', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'Faculty Enablement Workshop', description: 'embedding BRAVE', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'Alumni Support Extension', description: '12 months post-grad', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'BRAVE-as-a-Class (Online, Credit-Ready)', description: 'syllabus kit, slides, rubrics', essentials: 'not-included', core: 'not-included', max: 'premium' }
    ],
    ...(livePageSnapshot.content as Record<string, any>),
    videoUrl: '/ready/media/ace-overview.mp4',
    posterUrl: '/ready/media/ace-overview-poster.png'
  });

  const [analyticsStats, setAnalyticsStats] = useState({
    visitors: 0,
    avgDuration: 0,
    bounceRate: 0,
    videoEngagement: 0,
    ctaClicks: 0
  });

  const [editForm, setEditForm] = useState(content);

  // Initialize video tracking
  useEffect(() => {
    if (videoRef.current) {
      videoTrackerRef.current = setupVideoTracking(
        videoRef.current,
        'Welcome Video',
        true
      );

      return () => {
        if (videoTrackerRef.current) {
          videoTrackerRef.current.destroy();
        }
      };
    }
  }, []);

  // Load content from database on mount
  useEffect(() => {
    const defaultProgramDetails = [
      { feature: 'Primary job', description: 'What this tier is for', essentials: 'Modern job-search system + progress visibility', core: 'Weekly practice + expert feedback + coaching attendance visibility', max: 'Max live access + faculty enablement + alumni carry-through + class shell' },
      { feature: 'BRAVE 5-Step Job Search', description: 'structured curriculum', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Tools & Templates', description: 'résumé, cover, tracker, STAR, follow-ups', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Slack Community', description: 'peer help; moderated threads', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'AI Interview Practice', description: 'practice + bring Qs to live sessions', essentials: 'included', core: 'included', max: 'included' },
      { feature: '60-min Live Orientation', description: 'cohort kickoff', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Monthly Student Progress Reporting', description: 'one-page + CSV', essentials: 'included', core: 'enhanced', max: 'enhanced' },
      { feature: 'Quarterly Strategy Call (Career Services)', description: '', essentials: 'included', core: 'included', max: 'included' },
      { feature: 'Weekly Group Coaching', description: 'live, 60-minute', essentials: 'not-included', core: 'included', max: 'enhanced' },
      { feature: 'Résumé Review + LinkedIn Review', description: '', essentials: 'not-included', core: 'included', max: 'enhanced' },
      { feature: 'Coaching Attendance Visibility', description: 'appears in reporting', essentials: 'not-included', core: 'included', max: 'included' },
      { feature: 'Office Hours (AMA-style)', description: 'Tue/Thu evenings + Sat morning', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'Bootcamps', description: '2 per academic year', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'Faculty Enablement Workshop', description: 'embedding BRAVE', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'Alumni Support Extension', description: '12 months post-grad', essentials: 'not-included', core: 'not-included', max: 'premium' },
      { feature: 'BRAVE-as-a-Class (Online, Credit-Ready)', description: 'syllabus kit, slides, rubrics', essentials: 'not-included', core: 'not-included', max: 'premium' }
    ];

    const init = async () => {
      try {
        await checkAuth();
        const { data } = await railwayStore
          .from('page_content')
          .select('content')
          .eq('page_name', 'landing_page')
          .maybeSingle();

        if (data?.content) {
          // Merge with defaults to ensure new fields exist
          const mergedContent = {
            ...data.content,
            programDetailsTitle: data.content.programDetailsTitle || 'Click here to see program details',
            programDetails: data.content.programDetails || defaultProgramDetails
          };
          setContent(mergedContent);
          setEditForm(mergedContent);
        }
      } catch (error) {
        console.error('Failed to load content:', error);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load analytics when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
      // Refresh analytics every 30 seconds
      const interval = setInterval(loadAnalytics, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Track session duration on unmount
  useEffect(() => {
    return () => {
      const duration = Date.now() - sessionStart;
      trackEvent('session_end', { duration }).catch(err => console.error('Error tracking session end:', err));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStart]);

  // Exit-intent detection
  useEffect(() => {
    if (previewMode || exitIntentTriggered) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitIntentTriggered) {
        setExitIntentTriggered(true);
        setShowExitPopup(true);
        analytics.trackExitIntent();
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [previewMode, exitIntentTriggered]);

  const checkAuth = async () => {
    const { data: { session } } = await railwayStore.auth.getSession();
    const authenticated = !!session;
    setIsAuthenticated(authenticated);
    setPreviewMode(authenticated);

    // Listen for auth state changes
    railwayStore.auth.onAuthStateChange((_event: string, session: any) => {
      const authenticated = !!session;
      setIsAuthenticated(authenticated);
      setPreviewMode(authenticated);
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const { error } = await railwayStore.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setLoginError(error.message);
    } else {
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      setPreviewMode(true);
    }
  };

  const handleSignOut = async () => {
    await railwayStore.auth.signOut();
    setPreviewMode(false);
  };

  const loadContent = async () => {
    const { data } = await railwayStore
      .from('page_content')
      .select('content')
      .eq('page_name', 'landing_page')
      .maybeSingle();

    if (data?.content) {
      setContent(data.content);
      setEditForm(data.content);
    }
  };

  const loadAnalytics = async () => {
    const { data } = await railwayStore
      .from('page_analytics')
      .select('*');

    if (data) {
      const uniqueSessions = new Set(data.map(d => d.session_id)).size;
      const videoEvents = data.filter(d => d.event_type === 'video_play').length;
      const ctaEvents = data.filter(d => d.event_type === 'cta_click').length;

      const sessionDurations = data
        .filter(d => d.event_type === 'session_end')
        .map(d => d.metadata?.duration || 0);

      const avgDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        : 0;

      const bounces = data.filter(d =>
        d.event_type === 'session_end' && (d.metadata?.duration || 0) < 30000
      ).length;

      setAnalyticsStats({
        visitors: uniqueSessions,
        avgDuration: Math.round(avgDuration / 1000),
        bounceRate: uniqueSessions > 0 ? Math.round((bounces / uniqueSessions) * 100) : 0,
        videoEngagement: uniqueSessions > 0 ? Math.round((videoEvents / uniqueSessions) * 100) : 0,
        ctaClicks: ctaEvents
      });
    }
  };

  const trackEvent = async (eventType: string, metadata: any = {}) => {
    try {
      await railwayStore.from('page_analytics').insert({
        session_id: sessionId,
        event_type: eventType,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  const handleCtaClick = (buttonType: string, url: string) => {
    if (!url) return;

    // Open URL immediately, don't wait for tracking
    window.open(url, '_blank', 'noopener,noreferrer');

    // Track asynchronously without blocking
    trackEvent('cta_click', {
      button_type: buttonType,
      url: url,
      timestamp: new Date().toISOString()
    }).catch(err => console.error('Error tracking CTA click:', err));

    analytics.trackCTAClick(buttonType, url).catch(err => console.error('Error tracking CTA click analytics:', err));
  };

  // Track video progress milestones using ref to avoid re-render loops
  const trackedMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!videoRef.current || !duration || duration === 0) return;

    try {
      const progress = (currentTime / duration) * 100;
      const milestones = [25, 50, 75, 100];

      milestones.forEach(milestone => {
        if (progress >= milestone && !trackedMilestonesRef.current.has(milestone)) {
          trackedMilestonesRef.current.add(milestone);
          // Track async without blocking
          analytics.trackVideoProgress(milestone, currentTime).catch(err => {
            console.error('Error tracking video progress:', err);
          });
        }
      });
    } catch (error) {
      console.error('Error in video progress tracking:', error);
    }
  }, [currentTime, duration]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        trackEvent('video_pause', { time: currentTime });
      } else {
        videoRef.current.play();
        trackEvent('video_play', { time: currentTime });
        analytics.trackVideoPlay('Welcome Video');
        setHasPlayedVideo(true);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      trackEvent('video_rewind');
      analytics.trackInteraction('video_rewind', null, 'Video rewound 10 seconds');
    }
  };

  const handleStop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      trackEvent('video_stop');
      analytics.trackInteraction('video_stop', null, 'Video stopped');
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const loadBackups = async () => {
    const { data } = await railwayStore
      .from('content_backups')
      .select('*')
      .eq('page_name', 'home')
      .order('created_at', { ascending: false });

    if (data) {
      setBackups(data);
    }
  };

  const createBackup = async () => {
    if (!backupName.trim()) {
      alert('Please enter a backup name');
      return;
    }

    const { error } = await railwayStore
      .from('content_backups')
      .insert({
        page_name: 'home',
        content: content,
        backup_label: backupName.trim(),
        created_by: null
      });

    if (error) {
      alert('Failed to create backup: ' + error.message);
    } else {
      alert('Backup created successfully!');
      setBackupName('');
      loadBackups();
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? Current content will be overwritten.')) {
      return;
    }

    const { data, error } = await railwayStore
      .from('content_backups')
      .select('content')
      .eq('id', backupId)
      .single();

    if (error || !data) {
      alert('Failed to restore backup: ' + (error?.message || 'Backup not found'));
    } else {
      setContent(data.content);
      setEditForm(data.content);
      alert('Backup restored successfully! The page will reload.');
      window.location.reload();
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    const { error } = await railwayStore
      .from('content_backups')
      .delete()
      .eq('id', backupId);

    if (error) {
      alert('Failed to delete backup: ' + error.message);
    } else {
      alert('Backup deleted successfully!');
      loadBackups();
    }
  };

  const handleCTAClick = (label: string, url: string) => {
    trackEvent('cta_click', { label, url });
    analytics.trackCTAClick(label, url);
    window.open(url, '_blank');
  };

  const handleSaveContent = async () => {
    const { error } = await railwayStore
      .from('page_content')
      .upsert({
        page_name: 'landing_page',
        content: editForm,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'page_name'
      });

    if (!error) {
      setContent(editForm);
      setShowEditModal(false);
      trackEvent('content_updated');
    } else {
      console.error('Save error:', error);
      alert('Failed to save changes: ' + error.message);
    }
  };

  const updateContentField = async (field: string, value: any) => {
    const newContent = { ...content, [field]: value };
    setContent(newContent);

    // Save to database immediately
    await railwayStore
      .from('page_content')
      .upsert({
        page_name: 'landing_page',
        content: newContent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'page_name'
      });
  };

  const updateProgramDetail = async (index: number, field: string, value: string) => {
    const newDetails = [...content.programDetails];
    newDetails[index] = { ...newDetails[index], [field]: value };
    await updateContentField('programDetails', newDetails);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePainPointHoverStart = (index: number, section: 'student' | 'program', pointText: string) => {
    // Clear any existing timer
    if (painPointHoverTimer) {
      clearTimeout(painPointHoverTimer);
    }

    // Set a new timer for 2 seconds
    const timer = setTimeout(() => {
      // Track that user read this pain point for 2+ seconds
      analytics.trackPainPointRead(section, index, pointText, '2+seconds');
    }, 2000);

    setPainPointHoverTimer(timer);
  };

  const handlePainPointHoverEnd = () => {
    // Clear the timer if user stops hovering before 2 seconds
    if (painPointHoverTimer) {
      clearTimeout(painPointHoverTimer);
      setPainPointHoverTimer(null);
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', { name: file.name, type: file.type, size: file.size });

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid video file (MP4, WebM, or MOV)');
      return;
    }

    // Validate file size (max 250MB)
    const maxSize = 250 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Video file must be less than 250MB');
      return;
    }

    setUploadingVideo(true);
    setUploadProgress(5);

    try {
      console.log('Starting upload...');

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `welcome-video-${Date.now()}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      console.log('Upload path:', filePath);
      setUploadProgress(10);

      // Repository-managed media replaces the legacy browser upload path.
      const { data, error } = await railwayStore.storage
        .from('landing-page-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      console.log('Upload response:', { data, error });
      setUploadProgress(60);

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      setUploadProgress(70);

      console.log('Upload successful, getting public URL...');

      // Get public URL
      const { data: { publicUrl } } = railwayStore.storage
        .from('landing-page-assets')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);
      setUploadProgress(80);

      // Update content with new video URL
      const newContent = { ...editForm, videoUrl: publicUrl };
      setEditForm(newContent);

      console.log('Saving to database...');
      setUploadProgress(90);

      // Save to database
      const { error: dbError } = await railwayStore
        .from('page_content')
        .upsert({
          page_name: 'landing_page',
          content: newContent,
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.warn('Database save error (non-critical):', dbError);
      }

      setContent(newContent);
      setUploadProgress(100);
      trackEvent('video_uploaded', { fileName, fileSize: file.size });

      console.log('Upload complete!');
      alert('Video uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error details:', {
        message: error?.message,
        statusCode: error?.statusCode,
        error: error?.error,
        stack: error?.stack
      });
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to upload video: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setUploadingVideo(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };




  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      {!previewMode && (
        <div className="fixed top-4 left-4 z-40 hidden lg:block">
          <RotatingSticker />
        </div>
      )}
      {showExitPopup && (
        <ExitIntentPopup
          discoveryCallUrl={content.discoveryCallUrl}
          onClose={() => setShowExitPopup(false)}
        />
      )}


      {/* Hero Section - Combined with Video & CTAs */}
      <section className="py-[1.86rem] pb-1 px-4 sm:px-4 lg:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C00000] via-[#094886] to-black"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-slate-800 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwOTQ4ODYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDEzNGMwLTYuNjI3LTUuMzczLTEyLTEyLTEycy0xMiA1LjM3My0xMiAxMiA1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMnptMC00MGMwLTYuNjI3LTUuMzczLTEyLTEyLTEycy0xMiA1LjM3My0xMiAxMiA1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>
        <div className="absolute inset-0 opacity-[0.07]">
          <GraduationCap className="absolute top-20 left-10 w-16 h-16 text-[#094886]" />
          <Cpu className="absolute top-32 right-20 w-14 h-14 text-[#094886]" />
          <BookOpen className="absolute bottom-40 left-1/4 w-12 h-12 text-[#094886]" />
          <Code className="absolute top-1/3 right-1/4 w-16 h-16 text-[#094886]" />
          <Brain className="absolute bottom-24 right-12 w-14 h-14 text-[#094886]" />
          <Network className="absolute top-1/2 left-16 w-12 h-12 text-[#094886]" />
          <Database className="absolute bottom-1/3 right-1/3 w-10 h-10 text-[#094886]" />
          <Lightbulb className="absolute top-1/4 left-1/3 w-12 h-12 text-[#094886]" />
          <GraduationCap className="absolute bottom-16 left-20 w-14 h-14 text-[#094886]" />
          <Cpu className="absolute top-1/4 right-12 w-12 h-12 text-[#094886]" />
          <BookOpen className="absolute top-40 right-1/3 w-14 h-14 text-[#094886]" />
          <Code className="absolute bottom-1/4 left-1/3 w-12 h-12 text-[#094886]" />
          <Brain className="absolute top-16 left-1/4 w-12 h-12 text-[#094886]" />
          <Network className="absolute bottom-20 right-1/4 w-14 h-14 text-[#094886]" />
          <Database className="absolute top-1/3 left-12 w-14 h-14 text-[#094886]" />
          <Lightbulb className="absolute bottom-32 right-16 w-10 h-10 text-[#094886]" />
          <Server className="absolute top-24 right-1/4 w-12 h-12 text-[#094886]" />
          <Binary className="absolute bottom-1/4 left-16 w-10 h-10 text-[#094886]" />
          <Atom className="absolute top-1/2 right-20 w-12 h-12 text-[#094886]" />
          <Microscope className="absolute bottom-36 left-1/3 w-14 h-14 text-[#094886]" />
          <Target className="absolute top-36 left-1/4 w-10 h-10 text-[#094886]" />
          <Zap className="absolute bottom-28 right-1/3 w-12 h-12 text-[#094886]" />
          <BarChart3 className="absolute top-1/3 right-16 w-14 h-14 text-[#094886]" />
          <TrendingUp className="absolute bottom-1/3 left-20 w-12 h-12 text-[#094886]" />
          <Users className="absolute top-44 left-16 w-12 h-12 text-[#094886]" />
          <CheckCircle className="absolute bottom-1/2 right-1/4 w-10 h-10 text-[#094886]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Cheetah Mascot - Hidden until image is restored
          {showMascot && (
            <div className="hidden md:block absolute top-0 -right-8 lg:-right-4 xl:right-0 w-[380px] h-[420px] pointer-events-none z-[1]">
              <img
                src="/Untitled design.png"
                alt="Mascot"
                className="w-full h-full object-contain"
                style={{
                  filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))'
                }}
              />
            </div>
          )}
          */}
          <div className="max-w-[82.5%] mx-auto text-center px-4 mb-8 relative z-10">
            <h1 className="font-spartan text-[2.09rem] sm:text-[2.60rem] md:text-[3.13rem] lg:text-[3.64rem] font-extrabold text-white mb-2 leading-tight max-w-[850px] mx-auto block" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)' }}>
              <EditableText
                value={content.heroTitle}
                onChange={(value) => updateContentField('heroTitle', value)}
                previewMode={previewMode}
                className="font-spartan text-[2.09rem] sm:text-[2.60rem] md:text-[3.13rem] lg:text-[3.64rem] font-extrabold text-white leading-tight block"
              />
            </h1>
            <h2 className="font-spartan text-[2.09rem] sm:text-[2.60rem] md:text-[3.13rem] lg:text-[3.64rem] font-extrabold text-white mb-6 leading-tight max-w-[850px] mx-auto block" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)' }}>
              <EditableText
                value={content.heroSubtitle}
                onChange={(value) => updateContentField('heroSubtitle', value)}
                previewMode={previewMode}
                className="font-spartan text-[2.09rem] sm:text-[2.60rem] md:text-[3.13rem] lg:text-[3.64rem] font-extrabold text-white leading-tight block"
              />
            </h2>
            <div className="flex justify-center px-2 relative">
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-[#094886] font-bold mb-0 bg-white px-1.5 py-0.5 rounded-lg shadow-2xl relative overflow-hidden">
                <span className="relative z-10">
                  <EditableText
                    value={content.heroBenefit}
                    onChange={(value) => updateContentField('heroBenefit', value)}
                    previewMode={previewMode}
                    className="text-xs sm:text-sm md:text-base lg:text-lg text-[#094886] font-bold"
                  />
                </span>
              </p>
            </div>
            <div className="flex justify-center mt-4">
              <VisitorCounter />
            </div>
          </div>

          {/* Video and CTAs */}
          <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-center mt-8">
            {!previewMode && (
              <div className="lg:hidden w-full flex justify-center mb-4">
                <RotatingSticker />
              </div>
            )}
            <div className="w-full lg:w-[48.4%]">
              <div className={`bg-black rounded-xl overflow-hidden shadow-2xl relative group ${!hasPlayedVideo ? 'animate-pulse-glow' : ''}`}>
                <video
                  ref={videoRef}
                  src={content.videoUrl}
                  poster={content.posterUrl || undefined}
                  className="w-full cursor-pointer block leading-[0]"
                  style={{display: 'block', verticalAlign: 'middle'}}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={handlePlayPause}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  autoPlay
                  muted
                  playsInline
                  loop
                />
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity group-hover:bg-opacity-40">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#C00000] rounded-full animate-pulse-ring opacity-50"></div>
                      <button
                        onClick={handlePlayPause}
                        className="relative w-24 h-24 flex items-center justify-center bg-gradient-to-br from-[#C00000] to-[#8B0000] rounded-full shadow-2xl transform transition-all duration-300 hover:scale-110 hover:shadow-[0_0_40px_rgba(192,0,0,0.6)] animate-float-up"
                      >
                        <Play className="w-12 h-12 text-white ml-2" fill="white" />
                      </button>
                    </div>
                    <div className="absolute bottom-6 left-0 right-0 text-center">
                      <div className="bg-black bg-opacity-75 inline-block px-6 py-3 rounded-full">
                        <p className="text-white font-bold text-lg flex items-center gap-2">
                          <Video className="w-5 h-5" />
                          <EditableText
                            value={content.videoOverlayText || 'Watch Mini Overview'}
                            onChange={(value) => updateContentField('videoOverlayText', value)}
                            previewMode={previewMode}
                            className="text-white font-bold text-lg inline"
                          />
                          <span className="text-sm font-normal text-gray-300">({formatTime(duration)})</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-gradient-to-r from-black to-gray-900 px-4 py-2">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handlePlayPause}
                      className="w-9 h-9 flex items-center justify-center bg-[#C00000] hover:bg-[#a00000] rounded-full transition-colors shadow-lg"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                    </button>
                    <button
                      onClick={handleRewind}
                      className="w-8 h-8 flex items-center justify-center bg-[#094886] hover:bg-[#0a5ba3] rounded-full transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={handleStop}
                      className="w-8 h-8 flex items-center justify-center bg-[#094886] hover:bg-[#0a5ba3] rounded-full transition-colors"
                    >
                      <Square className="w-4 h-4 text-white" />
                    </button>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <span className="text-white text-xs whitespace-nowrap">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[38.7%] flex flex-col sm:flex-row lg:flex-col gap-4 lg:gap-3 relative z-20">
              <a
                href={previewMode ? '#' : (content.discoveryCallUrl || '#')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (previewMode) {
                    e.preventDefault();
                    const target = e.target as HTMLElement;
                    if (target.closest('.editable-text-wrapper')) {
                      return;
                    }
                    if (content.discoveryCallUrl) {
                      void trackEvent('cta_click', {
                        button_type: 'discovery_call',
                        url: content.discoveryCallUrl,
                        timestamp: new Date().toISOString()
                      });
                      void analytics.trackCTAClick('discovery_call', content.discoveryCallUrl);
                      window.open(content.discoveryCallUrl, '_blank');
                    }
                    return;
                  }
                  if (!content.discoveryCallUrl) {
                    e.preventDefault();
                    return;
                  }
                  void trackEvent('cta_click', {
                    button_type: 'discovery_call',
                    url: content.discoveryCallUrl,
                    timestamp: new Date().toISOString()
                  });
                  void analytics.trackCTAClick('discovery_call', content.discoveryCallUrl);
                }}
                className="group relative bg-gradient-to-r from-[#CE0E0E] to-[#AE0E0E] hover:from-[#E11A1A] hover:to-[#C11A1A] text-white font-bold py-4 lg:py-6 px-6 lg:px-8 rounded-xl shadow-[2.4px_4.8px_9.6px_rgba(0,0,0,0.3),4.8px_7.2px_14.4px_rgba(0,0,0,0.18)] hover:shadow-[4.8px_7.2px_14.4px_rgba(0,0,0,0.36),7.2px_9.6px_19.2px_rgba(0,0,0,0.24)] transition-all duration-300 transform hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1.2px_2.4px_4.8px_rgba(0,0,0,0.24)] flex-1 lg:flex-initial block text-center"
                style={{opacity: 0.95}}
              >
                <span className="flex flex-col items-center justify-center gap-1 text-base sm:text-lg lg:text-[1.32rem]" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.3), 0 0 10px rgba(0,0,0,0.2)' }}>
                  <span className="flex items-center gap-2 lg:gap-3">
                    <Calendar className="w-5 h-5 lg:w-6 lg:h-6" />
                    <EditableText
                      value={content.ctaDiscoveryTitle || 'Book Your Free Strategy Call'}
                      onChange={(value) => updateContentField('ctaDiscoveryTitle', value)}
                      previewMode={previewMode}
                      className="text-base sm:text-lg lg:text-[1.32rem] font-bold text-white inline"
                    />
                    <ExternalLink className="w-4 h-4 lg:w-5 lg:h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <span className="text-xs lg:text-sm font-normal opacity-90">
                    <EditableText
                      value={content.ctaDiscoverySubtitle || 'No commitment • 20 min call'}
                      onChange={(value) => updateContentField('ctaDiscoverySubtitle', value)}
                      previewMode={previewMode}
                      className="text-xs lg:text-sm font-normal opacity-90 inline"
                    />
                  </span>
                </span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity"></div>
              </a>

              <button
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('.editable-text-wrapper')) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  if (content.webinarUrl) {
                    handleCtaClick('webinar', content.webinarUrl);
                  }
                }}
                disabled={!content.webinarUrl}
                className="group relative bg-gradient-to-r from-[#095194] to-[#095D9E] hover:from-[#0A64AC] hover:to-[#0A71BA] text-white font-bold py-4 lg:py-6 px-6 lg:px-8 rounded-xl shadow-[2.4px_4.8px_9.6px_rgba(0,0,0,0.3),4.8px_7.2px_14.4px_rgba(0,0,0,0.18)] hover:shadow-[4.8px_7.2px_14.4px_rgba(0,0,0,0.36),7.2px_9.6px_19.2px_rgba(0,0,0,0.24)] transition-all duration-300 transform hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1.2px_2.4px_4.8px_rgba(0,0,0,0.24)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex-1 lg:flex-initial"
                style={{opacity: 0.95}}
              >
                <span className="flex flex-col items-center justify-center gap-1 text-base sm:text-lg lg:text-[1.32rem]" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.3), 0 0 10px rgba(0,0,0,0.2)' }}>
                  <span className="flex items-center gap-2 lg:gap-3">
                    <Video className="w-5 h-5 lg:w-6 lg:h-6" />
                    <EditableText
                      value={content.ctaWebinarTitle || content.webinarLabel || 'Join Next Program Overview Webinar'}
                      onChange={(value) => updateContentField('ctaWebinarTitle', value)}
                      previewMode={previewMode}
                      className="text-base sm:text-lg lg:text-[1.32rem] font-bold text-white inline"
                    />
                    <ExternalLink className="w-4 h-4 lg:w-5 lg:h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <span className="text-xs lg:text-sm font-normal opacity-90">
                    <EditableText
                      value={content.ctaWebinarSubtitle || 'Live Presentation and Expert Q&A'}
                      onChange={(value) => updateContentField('ctaWebinarSubtitle', value)}
                      previewMode={previewMode}
                      className="text-xs lg:text-sm font-normal opacity-90 inline"
                    />
                  </span>
                </span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity"></div>
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* Program Details Section - Top */}
      <section className="py-2 pb-2 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              const newState = !showProgramDetails;
              setShowProgramDetails(newState);
              if (newState) {
                analytics.trackInteraction('program_details_expand', 'program-details-toggle-top', 'Expanded program details section from top');
              } else {
                analytics.trackInteraction('program_details_collapse', 'program-details-toggle-top', 'Collapsed program details section from top');
              }
            }}
            className="w-full flex items-center justify-center gap-4 px-6 py-5 bg-white hover:bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 mb-6 group"
          >
            <div className="flex-shrink-0">
              <Zap className="w-7 h-7 md:w-9 md:h-9 text-[#C00000] group-hover:scale-110 transition-transform" fill="currentColor" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#094886] text-center">
              <EditableText
                value={content.programDetailsTitle || 'Click here to see program details'}
                onChange={(value) => updateContentField('programDetailsTitle', value)}
                previewMode={previewMode}
                className="text-2xl md:text-3xl font-extrabold text-[#094886]"
              />
            </h2>
            <div className="flex-shrink-0">
              {showProgramDetails ? (
                <Minus className="w-7 h-7 md:w-9 md:h-9 text-[#C00000] group-hover:scale-110 transition-transform" />
              ) : (
                <Plus className="w-7 h-7 md:w-9 md:h-9 text-[#C00000] group-hover:scale-110 transition-transform" />
              )}
            </div>
          </button>

          {showProgramDetails && content.programDetails && content.programDetails.length > 0 && (
            <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 animate-fadeIn overflow-x-auto">
              <ProgramDetailsTable
                details={content.programDetails}
                previewMode={previewMode}
                onUpdate={updateProgramDetail}
                discoveryCallUrl={content.discoveryCallUrl}
              />
            </div>
          )}
        </div>
      </section>

      {/* Student Pain Points */}
      <section className="pt-3 pb-10 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-slate-200"></div>
        <div className="absolute inset-0 bg-cover bg-center opacity-5" style={{ backgroundImage: 'url(https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=1920)' }}></div>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-20"><GraduationCap className="w-32 h-32" /></div>
          <div className="absolute bottom-20 left-20"><Users className="w-28 h-28" /></div>
          <div className="absolute top-1/2 left-1/4"><BookOpen className="w-24 h-24" /></div>
          <div className="absolute bottom-1/3 right-1/3"><Brain className="w-26 h-26" /></div>
          <div className="absolute top-1/3 right-10"><Microscope className="w-20 h-20" /></div>
          <div className="absolute bottom-10 left-1/3"><Lightbulb className="w-22 h-22" /></div>
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center justify-center mb-3">
            <GraduationCap className="w-10 h-10 text-[#C00000] mr-2" />
            <h2 className="text-[1.7rem] md:text-[2.1rem] font-bold text-center text-[#094886]">
              <EditableText
                value={content.studentPainPointsTitle}
                onChange={(value) => updateContentField('studentPainPointsTitle', value)}
                previewMode={previewMode}
                className="text-[1.7rem] md:text-[2.1rem] font-bold text-center text-[#094886]"
              />
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {(content.studentPainPoints || []).map((point, idx) => (
              <div
                key={idx}
                className={`bg-white p-4 rounded-xl shadow-xl border-l-4 border-[#C00000] transition-all duration-500 min-h-[50px] animate-slide-in-up cursor-pointer relative ${
                  hoveredStudentPain === idx
                    ? 'scale-125 shadow-2xl z-50'
                    : 'hover:shadow-2xl hover:scale-105'
                }`}
                style={{animationDelay: `${idx * 0.1}s`}}
                onMouseEnter={() => {
                  setHoveredStudentPain(idx);
                  handlePainPointHoverStart(idx, 'student', point);
                }}
                onMouseLeave={() => {
                  setHoveredStudentPain(null);
                  handlePainPointHoverEnd();
                }}
              >
                <div className="flex items-center justify-center h-full relative">
                  <div className={`absolute left-0 bg-[#C00000] rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    hoveredStudentPain === idx ? 'w-9 h-9' : 'w-7 h-7'
                  }`}>
                    <span className={`text-white font-bold transition-all ${
                      hoveredStudentPain === idx ? 'text-base' : 'text-sm'
                    }`}>{idx + 1}</span>
                  </div>
                  <div className={`flex-1 pr-8 transition-all ${
                    hoveredStudentPain === idx ? 'pl-12' : 'pl-8'
                  }`}>
                    <EditableText
                      value={point}
                      onChange={(value) => {
                        const newPoints = [...content.studentPainPoints];
                        newPoints[idx] = value;
                        updateContentField('studentPainPoints', newPoints);
                      }}
                      previewMode={previewMode}
                      className={`text-gray-800 leading-tight font-medium text-left block w-full transition-all ${
                        hoveredStudentPain === idx ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
            {hoveredStudentPain !== null && (
              <div className="fixed inset-0 bg-black/50 z-40" />
            )}
          </div>
        </div>
      </section>

      {/* Program Pain Points */}
      <section className="pt-2 pb-5 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-gray-100"></div>
        <div className="absolute inset-0 bg-cover bg-center opacity-5" style={{ backgroundImage: 'url(https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=1920)' }}></div>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20"><BarChart3 className="w-32 h-32" /></div>
          <div className="absolute bottom-20 right-20"><Clock className="w-28 h-28" /></div>
          <div className="absolute top-1/3 right-1/4"><Database className="w-24 h-24" /></div>
          <div className="absolute bottom-1/4 left-1/3"><Cpu className="w-26 h-26" /></div>
          <div className="absolute top-1/2 left-10"><Network className="w-20 h-20" /></div>
          <div className="absolute bottom-1/2 right-10"><Code className="w-22 h-22" /></div>
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center justify-center mb-3">
            <BarChart3 className="w-10 h-10 text-[#C00000] mr-2" />
            <h2 className="text-[1.7rem] md:text-[2.1rem] font-bold text-center text-[#094886]">
              <EditableText
                value={content.programPainPointsTitle}
                onChange={(value) => updateContentField('programPainPointsTitle', value)}
                previewMode={previewMode}
                className="text-[1.7rem] md:text-[2.1rem] font-bold text-center text-[#094886]"
              />
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {(content.programPainPoints || []).map((point, idx) => (
              <div
                key={idx}
                className={`bg-white p-4 rounded-xl shadow-xl border-l-4 border-[#094886] transition-all duration-500 min-h-[50px] animate-slide-in-up cursor-pointer relative ${
                  hoveredProgramPain === idx
                    ? 'scale-125 shadow-2xl z-50'
                    : 'hover:shadow-2xl hover:scale-105'
                }`}
                style={{animationDelay: `${idx * 0.1}s`}}
                onMouseEnter={() => {
                  setHoveredProgramPain(idx);
                  handlePainPointHoverStart(idx, 'program', point);
                }}
                onMouseLeave={() => {
                  setHoveredProgramPain(null);
                  handlePainPointHoverEnd();
                }}
              >
                <div className="flex items-center justify-center h-full relative">
                  <div className={`absolute left-0 bg-[#094886] rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    hoveredProgramPain === idx ? 'w-9 h-9' : 'w-7 h-7'
                  }`}>
                    <span className={`text-white font-bold transition-all ${
                      hoveredProgramPain === idx ? 'text-base' : 'text-sm'
                    }`}>{idx + 1}</span>
                  </div>
                  <div className={`flex-1 pr-8 transition-all ${
                    hoveredProgramPain === idx ? 'pl-12' : 'pl-8'
                  }`}>
                    <EditableText
                      value={point}
                      onChange={(value) => {
                        const newPoints = [...content.programPainPoints];
                        newPoints[idx] = value;
                        updateContentField('programPainPoints', newPoints);
                      }}
                      previewMode={previewMode}
                      className={`text-gray-800 leading-tight font-medium text-left block w-full transition-all ${
                        hoveredProgramPain === idx ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
            {hoveredProgramPain !== null && (
              <div className="fixed inset-0 bg-black/50 z-40" />
            )}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#094886] via-black to-[#094886] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10"><Brain className="w-32 h-32" /></div>
          <div className="absolute top-1/3 right-10"><Cpu className="w-24 h-24" /></div>
          <div className="absolute bottom-20 left-1/4"><Network className="w-28 h-28" /></div>
          <div className="absolute bottom-10 right-1/3"><Zap className="w-20 h-20" /></div>
          <div className="absolute top-1/2 left-1/2"><Target className="w-36 h-36" /></div>
          <div className="absolute top-20 right-1/4"><Atom className="w-24 h-24" /></div>
          <div className="absolute bottom-1/3 left-10"><Binary className="w-26 h-26" /></div>
          <div className="absolute top-2/3 right-10"><Server className="w-22 h-22" /></div>
          <div className="absolute bottom-1/2 left-1/3"><BookOpen className="w-28 h-28" /></div>
          <div className="absolute top-1/4 left-1/4"><Lightbulb className="w-20 h-20" /></div>
          <div className="absolute bottom-1/4 right-1/4"><Database className="w-24 h-24" /></div>
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center justify-center mb-6">
            <Sparkles className="w-12 h-12 text-[#C00000] mr-3" />
            <h2 className="text-[2.08rem] md:text-[2.50rem] font-bold text-center text-white">
              <EditableText
                value={content.solutionTitle}
                onChange={(value) => updateContentField('solutionTitle', value)}
                previewMode={previewMode}
                className="text-[2.08rem] md:text-[2.50rem] font-bold text-center text-white"
              />
            </h2>
            <Sparkles className="w-12 h-12 text-[#C00000] ml-3" />
          </div>
          <div className="bg-[#C00000]/20 backdrop-blur-lg rounded-2xl p-8 mb-12 text-center border-2 border-white/30">
            <div className="inline-flex items-center space-x-3 bg-white px-8 py-4 rounded-full shadow-2xl">
              <Zap className="w-8 h-8 text-[#C00000]" />
              <span className="text-4xl font-bold text-[#094886]">{content.fastPlacementStat}</span>
              <span className="text-xl font-semibold text-black">FASTER</span>
              <Zap className="w-8 h-8 text-[#C00000]" />
            </div>
            <p className="text-white text-2xl font-semibold mt-6">
              <EditableText
                value={content.solutionTagline}
                onChange={(value) => updateContentField('solutionTagline', value)}
                previewMode={previewMode}
                className="text-white text-2xl font-semibold"
              />
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {(content.programElements || []).map((element, idx) => (
              <div key={idx} className="bg-white rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105 border-l-4 border-[#C00000] animate-slide-in-up" style={{animationDelay: `${idx * 0.08}s`}}>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#094886] flex-shrink-0" />
                  <EditableText
                    value={element}
                    onChange={(value) => {
                      const newElements = [...content.programElements];
                      newElements[idx] = value;
                      updateContentField('programElements', newElements);
                    }}
                    previewMode={previewMode}
                    className="text-gray-900 font-semibold"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Details Section - Bottom */}
      <section className="py-2 pb-2 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              const newState = !showProgramDetails;
              setShowProgramDetails(newState);
              if (newState) {
                analytics.trackInteraction('program_details_expand', 'program-details-toggle-bottom', 'Expanded program details section from bottom');
              } else {
                analytics.trackInteraction('program_details_collapse', 'program-details-toggle-bottom', 'Collapsed program details section from bottom');
              }
            }}
            className="w-full flex items-center justify-center gap-4 px-6 py-5 bg-white hover:bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 mb-6 group"
          >
            <div className="flex-shrink-0">
              <Zap className="w-7 h-7 md:w-9 md:h-9 text-[#C00000] group-hover:scale-110 transition-transform" fill="currentColor" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#094886] text-center">
              <EditableText
                value={content.programDetailsTitle || 'Click here to see program details'}
                onChange={(value) => updateContentField('programDetailsTitle', value)}
                previewMode={previewMode}
                className="text-2xl md:text-3xl font-extrabold text-[#094886]"
              />
            </h2>
            <div className="flex-shrink-0">
              {showProgramDetails ? (
                <Minus className="w-7 h-7 md:w-9 md:h-9 text-[#C00000] group-hover:scale-110 transition-transform" />
              ) : (
                <Plus className="w-7 h-7 md:w-9 md:h-9 text-[#C00000] group-hover:scale-110 transition-transform" />
              )}
            </div>
          </button>

          {showProgramDetails && content.programDetails && content.programDetails.length > 0 && (
            <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 animate-fadeIn overflow-x-auto">
              <ProgramDetailsTable
                details={content.programDetails}
                previewMode={previewMode}
                onUpdate={updateProgramDetail}
                discoveryCallUrl={content.discoveryCallUrl}
              />
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#C00000] via-[#094886] to-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20"><GraduationCap className="w-40 h-40" /></div>
          <div className="absolute bottom-20 left-20"><Brain className="w-32 h-32" /></div>
          <div className="absolute top-1/2 left-10"><Cpu className="w-28 h-28" /></div>
          <div className="absolute bottom-1/3 right-1/4"><Network className="w-24 h-24" /></div>
          <div className="absolute top-1/3 left-1/3"><BookOpen className="w-26 h-26" /></div>
          <div className="absolute bottom-1/2 right-10"><Lightbulb className="w-30 h-30" /></div>
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              <EditableText
                value={content.ctaTitle}
                onChange={(value) => updateContentField('ctaTitle', value)}
                previewMode={previewMode}
                className="text-3xl md:text-4xl font-bold text-white"
              />
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <a
              href={previewMode ? '#' : (content.discoveryCallUrl || '#')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (previewMode) {
                  e.preventDefault();
                  const target = e.target as HTMLElement;
                  if (target.closest('.editable-text-wrapper')) {
                    return;
                  }
                  if (content.discoveryCallUrl) {
                    void trackEvent('cta_click', {
                      button_type: 'discovery_call',
                      url: content.discoveryCallUrl,
                      timestamp: new Date().toISOString()
                    });
                    void analytics.trackCTAClick('discovery_call', content.discoveryCallUrl);
                    window.open(content.discoveryCallUrl, '_blank');
                  }
                  return;
                }
                if (!content.discoveryCallUrl) {
                  e.preventDefault();
                  return;
                }
                void trackEvent('cta_click', {
                  button_type: 'discovery_call',
                  url: content.discoveryCallUrl,
                  timestamp: new Date().toISOString()
                });
                void analytics.trackCTAClick('discovery_call', content.discoveryCallUrl);
              }}
              className="group relative bg-gradient-to-r from-[#CE0E0E] to-[#AE0E0E] hover:from-[#E11A1A] hover:to-[#C11A1A] text-white font-bold py-4 lg:py-6 px-6 lg:px-8 rounded-xl shadow-[2.4px_4.8px_9.6px_rgba(0,0,0,0.3),4.8px_7.2px_14.4px_rgba(0,0,0,0.18)] hover:shadow-[4.8px_7.2px_14.4px_rgba(0,0,0,0.36),7.2px_9.6px_19.2px_rgba(0,0,0,0.24)] transition-all duration-300 transform hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1.2px_2.4px_4.8px_rgba(0,0,0,0.24)] flex-1 block text-center"
              style={{opacity: 0.95}}
            >
              <span className="flex flex-col items-center justify-center gap-1 text-base sm:text-lg lg:text-[1.32rem]" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.3), 0 0 10px rgba(0,0,0,0.2)' }}>
                <span className="flex items-center gap-2 lg:gap-3">
                  <Calendar className="w-5 h-5 lg:w-6 lg:h-6" />
                  <EditableText
                    value={content.ctaDiscoveryTitle || 'Book Your Free Strategy Call'}
                    onChange={(value) => updateContentField('ctaDiscoveryTitle', value)}
                    previewMode={previewMode}
                    className="text-base sm:text-lg lg:text-[1.32rem] font-bold text-white inline"
                  />
                  <ExternalLink className="w-4 h-4 lg:w-5 lg:h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="text-xs lg:text-sm font-normal opacity-90">
                  <EditableText
                    value={content.ctaDiscoverySubtitle || 'No commitment • 20 min call'}
                    onChange={(value) => updateContentField('ctaDiscoverySubtitle', value)}
                    previewMode={previewMode}
                    className="text-xs lg:text-sm font-normal opacity-90 inline"
                  />
                </span>
              </span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity"></div>
            </a>

            <button
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.editable-text-wrapper')) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                if (content.webinarUrl) {
                  handleCtaClick('webinar', content.webinarUrl);
                }
              }}
              disabled={!content.webinarUrl}
              className="group relative bg-gradient-to-r from-[#095194] to-[#095D9E] hover:from-[#0A64AC] hover:to-[#0A71BA] text-white font-bold py-4 lg:py-6 px-6 lg:px-8 rounded-xl shadow-[2.4px_4.8px_9.6px_rgba(0,0,0,0.3),4.8px_7.2px_14.4px_rgba(0,0,0,0.18)] hover:shadow-[4.8px_7.2px_14.4px_rgba(0,0,0,0.36),7.2px_9.6px_19.2px_rgba(0,0,0,0.24)] transition-all duration-300 transform hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1.2px_2.4px_4.8px_rgba(0,0,0,0.24)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex-1"
              style={{opacity: 0.95}}
            >
              <span className="flex flex-col items-center justify-center gap-1 text-base sm:text-lg lg:text-[1.32rem]" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.3), 0 0 10px rgba(0,0,0,0.2)' }}>
                <span className="flex items-center gap-2 lg:gap-3">
                  <Video className="w-5 h-5 lg:w-6 lg:h-6" />
                  <EditableText
                    value={content.ctaWebinarTitle || content.webinarLabel || 'Join Next Program Overview Webinar'}
                    onChange={(value) => updateContentField('ctaWebinarTitle', value)}
                    previewMode={previewMode}
                    className="text-base sm:text-lg lg:text-[1.32rem] font-bold text-white inline"
                  />
                  <ExternalLink className="w-4 h-4 lg:w-5 lg:h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="text-xs lg:text-sm font-normal opacity-90">
                  <EditableText
                    value={content.ctaWebinarSubtitle || 'Live Presentation and Expert Q&A'}
                    onChange={(value) => updateContentField('ctaWebinarSubtitle', value)}
                    previewMode={previewMode}
                    className="text-xs lg:text-sm font-normal opacity-90 inline"
                  />
                </span>
              </span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity"></div>
            </button>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-2xl hidden">
            <h3 className="text-2xl font-bold text-[#094886] mb-6 flex items-center">
              <Download className="w-6 h-6 mr-3 text-[#C00000]" />
              <EditableText
                value={content.downloadResourcesTitle}
                onChange={(value) => updateContentField('downloadResourcesTitle', value)}
                previewMode={previewMode}
                className="text-2xl font-bold text-[#094886]"
              />
            </h3>
            {content.downloadGuide.kajabiEmbedUrl ? (
              <div className="w-full">
                <iframe
                  src={content.downloadGuide.kajabiEmbedUrl}
                  width="100%"
                  height="400"
                  frameBorder="0"
                  style={{ border: 'none' }}
                  title="Kajabi Form"
                ></iframe>
              </div>
            ) : (
              <button
                onClick={() => handleCTAClick(content.downloadGuide.label, content.downloadGuide.url)}
                className="w-full flex items-center justify-between px-8 py-5 bg-gradient-to-r from-[#C00000] to-[#a00000] hover:from-[#a00000] hover:to-[#C00000] text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                <span className="font-semibold text-lg">{content.downloadGuide.label}</span>
                <Download className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Admin Controls */}
      {isAuthenticated && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="w-14 h-14 bg-[#C00000] hover:bg-[#a00000] text-white rounded-full shadow-2xl flex items-center justify-center transition-all"
            title="Edit Mode"
          >
            <Square className="w-6 h-6" />
          </button>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
              previewMode
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-white hover:bg-gray-100 text-[#094886]'
            }`}
            title={previewMode ? 'Preview ON' : 'Preview OFF'}
          >
            <Eye className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-14 h-14 bg-[#094886] hover:bg-[#0a5ba3] text-white rounded-full shadow-2xl flex items-center justify-center transition-all"
            title="Analytics"
          >
            <BarChart3 className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              loadBackups();
              setShowBackupModal(true);
            }}
            className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all"
            title="Backup & Restore"
          >
            <Download className="w-6 h-6" />
          </button>
          <button
            onClick={handleSignOut}
            className="w-14 h-14 bg-gray-700 hover:bg-gray-800 text-white rounded-full shadow-2xl flex items-center justify-center transition-all"
            title="Sign Out"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="fixed bottom-24 right-6 w-80 bg-white rounded-xl shadow-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Analytics Dashboard</h3>
            <button onClick={() => setShowAnalytics(false)} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-gray-700">Visitors</span>
              </div>
              <span className="font-bold text-gray-900">{analyticsStats.visitors}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">Avg Duration</span>
              </div>
              <span className="font-bold text-gray-900">{analyticsStats.avgDuration}s</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-gray-700">Bounce Rate</span>
              </div>
              <span className="font-bold text-gray-900">{analyticsStats.bounceRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Video className="w-5 h-5 text-red-600" />
                <span className="text-gray-700">Video Engagement</span>
              </div>
              <span className="font-bold text-gray-900">{analyticsStats.videoEngagement}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-orange-600" />
                <span className="text-gray-700">CTA Clicks</span>
              </div>
              <span className="font-bold text-gray-900">{analyticsStats.ctaClicks}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Edit Page Content</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={editForm.siteName}
                  onChange={(e) => setEditForm({ ...editForm, siteName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hero Title</label>
                <input
                  type="text"
                  value={editForm.heroTitle}
                  onChange={(e) => setEditForm({ ...editForm, heroTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hero Subtitle</label>
                <input
                  type="text"
                  value={editForm.heroSubtitle}
                  onChange={(e) => setEditForm({ ...editForm, heroSubtitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hero Benefit</label>
                <input
                  type="text"
                  value={editForm.heroBenefit}
                  onChange={(e) => setEditForm({ ...editForm, heroBenefit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Video URL</label>
                <input
                  type="text"
                  value={editForm.videoUrl}
                  onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/mov,video/quicktime"
                    onChange={handleVideoUpload}
                    className="hidden"
                    disabled={uploadingVideo}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingVideo}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all"
                  >
                    {uploadingVideo ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Uploading... {uploadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span>Upload Video File</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Supported formats: MP4, WebM, MOV (Max 100MB)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Video Poster URL</label>
                <input
                  type="text"
                  value={editForm.posterUrl}
                  onChange={(e) => setEditForm({ ...editForm, posterUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="URL for video thumbnail (shown before play)"
                />
                <p className="text-xs text-gray-500 mt-1">Image shown before video plays</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Discovery Call URL</label>
                <input
                  type="url"
                  value={editForm.discoveryCallUrl}
                  onChange={(e) => setEditForm({ ...editForm, discoveryCallUrl: e.target.value })}
                  placeholder="https://meetings-na2.hubspot.com/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">URL for "Pick a Discovery Call Time" button</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Webinar Button Label</label>
                <input
                  type="text"
                  value={editForm.webinarLabel}
                  onChange={(e) => setEditForm({ ...editForm, webinarLabel: e.target.value })}
                  placeholder="Sign up for Next Webinar"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Label text for the webinar button</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Webinar URL</label>
                <input
                  type="url"
                  value={editForm.webinarUrl}
                  onChange={(e) => setEditForm({ ...editForm, webinarUrl: e.target.value })}
                  placeholder="https://zoom.us/webinar/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">URL for the webinar button</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fast Placement Stat</label>
                <input
                  type="text"
                  value={editForm.fastPlacementStat}
                  onChange={(e) => setEditForm({ ...editForm, fastPlacementStat: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Student Pain Points Title</label>
                <input
                  type="text"
                  value={editForm.studentPainPointsTitle}
                  onChange={(e) => setEditForm({ ...editForm, studentPainPointsTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Student Pain Points Subtitle</label>
                <input
                  type="text"
                  value={editForm.studentPainPointsSubtitle}
                  onChange={(e) => setEditForm({ ...editForm, studentPainPointsSubtitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Program Pain Points Title</label>
                <input
                  type="text"
                  value={editForm.programPainPointsTitle}
                  onChange={(e) => setEditForm({ ...editForm, programPainPointsTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Program Pain Points Subtitle</label>
                <input
                  type="text"
                  value={editForm.programPainPointsSubtitle}
                  onChange={(e) => setEditForm({ ...editForm, programPainPointsSubtitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Title</label>
                <input
                  type="text"
                  value={editForm.solutionTitle}
                  onChange={(e) => setEditForm({ ...editForm, solutionTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Tagline</label>
                <input
                  type="text"
                  value={editForm.solutionTagline}
                  onChange={(e) => setEditForm({ ...editForm, solutionTagline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Testimonials Title</label>
                <input
                  type="text"
                  value={editForm.testimonialsTitle}
                  onChange={(e) => setEditForm({ ...editForm, testimonialsTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Testimonials Subtitle</label>
                <input
                  type="text"
                  value={editForm.testimonialsSubtitle}
                  onChange={(e) => setEditForm({ ...editForm, testimonialsSubtitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CTA Title</label>
                <input
                  type="text"
                  value={editForm.ctaTitle}
                  onChange={(e) => setEditForm({ ...editForm, ctaTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CTA Subtitle</label>
                <input
                  type="text"
                  value={editForm.ctaSubtitle}
                  onChange={(e) => setEditForm({ ...editForm, ctaSubtitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CTA Banner</label>
                <input
                  type="text"
                  value={editForm.ctaBanner}
                  onChange={(e) => setEditForm({ ...editForm, ctaBanner: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Footer Tagline</label>
                <input
                  type="text"
                  value={editForm.footerTagline}
                  onChange={(e) => setEditForm({ ...editForm, footerTagline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Meeting Links</label>
                {(editForm.meetingLinks || []).map((link, idx) => (
                  <div key={idx} className="mb-3 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => {
                        const newLinks = [...editForm.meetingLinks];
                        newLinks[idx].label = e.target.value;
                        setEditForm({ ...editForm, meetingLinks: newLinks });
                      }}
                      className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...editForm.meetingLinks];
                        newLinks[idx].url = e.target.value;
                        setEditForm({ ...editForm, meetingLinks: newLinks });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Webinar Links</label>
                {(editForm.webinarLinks || []).map((link, idx) => (
                  <div key={idx} className="mb-3 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => {
                        const newLinks = [...editForm.webinarLinks];
                        newLinks[idx].label = e.target.value;
                        setEditForm({ ...editForm, webinarLinks: newLinks });
                      }}
                      className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...editForm.webinarLinks];
                        newLinks[idx].url = e.target.value;
                        setEditForm({ ...editForm, webinarLinks: newLinks });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Download Resources Title</label>
                <input
                  type="text"
                  value={editForm.downloadResourcesTitle}
                  onChange={(e) => setEditForm({ ...editForm, downloadResourcesTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Download Guide</label>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    placeholder="Label (e.g., Download program overview guide)"
                    value={editForm.downloadGuide.label}
                    onChange={(e) => setEditForm({ ...editForm, downloadGuide: { ...editForm.downloadGuide, label: e.target.value }})}
                    className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Download URL (leave empty if using Kajabi form)"
                    value={editForm.downloadGuide.url}
                    onChange={(e) => setEditForm({ ...editForm, downloadGuide: { ...editForm.downloadGuide, url: e.target.value }})}
                    className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Kajabi Embed URL (optional - overrides download button)"
                    value={editForm.downloadGuide.kajabiEmbedUrl}
                    onChange={(e) => setEditForm({ ...editForm, downloadGuide: { ...editForm.downloadGuide, kajabiEmbedUrl: e.target.value }})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end space-x-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContent}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Admin Login</h2>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {loginError}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#094886] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#094886] focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-3 bg-[#094886] text-white rounded-lg hover:bg-[#073a6b] transition-colors font-semibold"
              >
                Sign In
              </button>
            </form>

          </div>
        </div>
      )}

      {/* Backup & Restore Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Backup & Restore</h2>
                <button
                  onClick={() => setShowBackupModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Create New Backup</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                    placeholder="Enter backup name"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={createBackup}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Create Backup
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Available Backups</h3>
                {backups.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No backups available</p>
                ) : (
                  <div className="space-y-2">
                    {backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{backup.backup_label}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(backup.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => restoreBackup(backup.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
