/**
 * Facade de ícones — re-exporta Heroicons (24/outline) sob os mesmos nomes
 * que o codebase originalmente usava com lucide-react.
 *
 * Para migrar, basta trocar:
 *   import { Foo } from "@/components/icons"
 * por:
 *   import { Foo } from "@/components/icons"
 */
import type { ComponentType, SVGProps } from "react";
import {
  AcademicCapIcon,
  AdjustmentsHorizontalIcon,
  ArchiveBoxIcon,
  ArrowDownRightIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowLeftEndOnRectangleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowUpRightIcon,
  ArrowUpTrayIcon,
  ArrowUturnLeftIcon,
  ArrowsRightLeftIcon,
  Bars3Icon,
  Bars3BottomLeftIcon,
  BeakerIcon,
  BellIcon,
  BoltIcon,
  BookmarkIcon,
  BugAntIcon,
  BuildingOffice2Icon,
  CalendarIcon,
  CalendarDaysIcon,
  CameraIcon,
  ChartBarIcon,
  ChartBarSquareIcon,
  ChartPieIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  ChatBubbleOvalLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronUpDownIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  CogIcon,
  CommandLineIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  CursorArrowRaysIcon,
  DevicePhoneMobileIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  DocumentChartBarIcon,
  DocumentCheckIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  FaceFrownIcon,
  FaceSmileIcon,
  FireIcon,
  FunnelIcon,
  GlobeAltIcon,
  HashtagIcon,
  HeartIcon,
  HomeIcon,
  InboxIcon,
  InformationCircleIcon,
  KeyIcon,
  LifebuoyIcon,
  LightBulbIcon,
  LinkIcon,
  ListBulletIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  MapIcon,
  MapPinIcon,
  MicrophoneIcon,
  MinusIcon,
  MoonIcon,
  NoSymbolIcon,
  PaintBrushIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PauseIcon,
  PencilIcon,
  PhoneArrowUpRightIcon,
  PhoneIcon,
  PhotoIcon,
  PlayCircleIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  QuestionMarkCircleIcon,
  QueueListIcon,
  RadioIcon,
  RocketLaunchIcon,
  ShareIcon,
  ShieldCheckIcon,
  SignalIcon,
  SparklesIcon,
  Square3Stack3DIcon,
  Squares2X2Icon,
  StarIcon,
  StopCircleIcon,
  SunIcon,
  TableCellsIcon,
  TagIcon,
  TrashIcon,
  TrophyIcon,
  UserCircleIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  VideoCameraIcon,
  ViewfinderCircleIcon,
  WalletIcon,
  WifiIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Tipo genérico compatível com o que era `LucideIcon` no codebase.
export type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

// ─── Aliases (lucide-name → Heroicons component) ────────────────────────────

export const Activity = BoltIcon;
export const AlertCircle = ExclamationCircleIcon;
export const AlertOctagon = NoSymbolIcon;
export const AlertTriangle = ExclamationTriangleIcon;
export const ArrowDownRight = ArrowDownRightIcon;
export const ArrowLeft = ArrowLeftIcon;
export const ArrowRight = ArrowRightIcon;
export const ArrowUpRight = ArrowUpRightIcon;
export const Award = TrophyIcon;
export const Ban = NoSymbolIcon;
export const BarChart = ChartBarIcon;
export const BarChart2 = ChartBarIcon;
export const BarChart3 = ChartBarIcon;
export const Battery = BoltIcon;
export const Bell = BellIcon;
export const Bookmark = BookmarkIcon;
export const Bot = SparklesIcon;
export const Brain = LightBulbIcon;
export const Bug = BugAntIcon;
export const Building2 = BuildingOffice2Icon;
export const Calendar = CalendarIcon;
export const CalendarCheck = CalendarDaysIcon;
export const CalendarDays = CalendarDaysIcon;
export const CalendarRange = CalendarDaysIcon;
export const CalendarX = CalendarIcon;
export const Camera = CameraIcon;
export const Check = CheckIcon;
export const CheckCheck = CheckIcon;
export const CheckCircle2 = CheckCircleIcon;
export { CheckIcon };
export const ChevronDown = ChevronDownIcon;
export { ChevronDownIcon };
export const ChevronLeft = ChevronLeftIcon;
export { ChevronLeftIcon };
export const ChevronRight = ChevronRightIcon;
export { ChevronRightIcon };
export { ChevronUpIcon };
export const ChevronsUpDown = ChevronUpDownIcon;
export const CircleIcon = StopCircleIcon;
export const ClipboardCheck = ClipboardDocumentCheckIcon;
export const ClipboardCopy = ClipboardDocumentIcon;
export const ClipboardList = ClipboardDocumentListIcon;
export const ClipboardPlus = ClipboardDocumentListIcon;
export const Clock = ClockIcon;
export const Clock3 = ClockIcon;
export const Cog = CogIcon;
export const Command = CommandLineIcon;
export const Contact = UserIcon;
export const Copy = DocumentDuplicateIcon;
export const CreditCard = CreditCardIcon;
export const DollarSign = CurrencyDollarIcon;
export const Download = ArrowDownTrayIcon;
export const Edit2 = PencilIcon;
export const ExternalLink = ArrowTopRightOnSquareIcon;
export const Eye = EyeIcon;
export const EyeOff = EyeSlashIcon;
export const FileBarChart = DocumentChartBarIcon;
export const FileDown = DocumentArrowDownIcon;
export const FileImage = PhotoIcon;
export const FileSpreadsheet = TableCellsIcon;
export const FileText = DocumentTextIcon;
export const FileUp = DocumentArrowUpIcon;
export const Filter = FunnelIcon;
export const Flame = FireIcon;
export const Frown = FaceFrownIcon;
export const Gauge = ChartBarSquareIcon;
export const Ghost = SparklesIcon;
export const GitBranch = ShareIcon;
export const GitCompare = ArrowsRightLeftIcon;
export const Globe = GlobeAltIcon;
export const Hash = HashtagIcon;
export const Headset = MicrophoneIcon;
export const HeartPulse = HeartIcon;
export const HelpCircle = QuestionMarkCircleIcon;
export const History = ClockIcon;
export const Home = HomeIcon;
export const Hourglass = ClockIcon;
export const Image = PhotoIcon;
export const ImageIcon = PhotoIcon;
export const ImageOff = NoSymbolIcon;
export const ImagePlus = PhotoIcon;
export const ImageUp = ArrowUpTrayIcon;
export const Inbox = InboxIcon;
export const Infinity = ArrowPathIcon;
export const Info = InformationCircleIcon;
export const KeyRound = KeyIcon;
export const Keyboard = CommandLineIcon;
export const Layers = Square3Stack3DIcon;
export const LayoutDashboard = Squares2X2Icon;
export const LayoutGrid = Squares2X2Icon;
export const LifeBuoy = LifebuoyIcon;
export const Lightbulb = LightBulbIcon;
export const LineChart = ArrowTrendingUpIcon;
export const Link = LinkIcon;
export const Link2 = LinkIcon;
export { LinkIcon };
export const ListChecks = ListBulletIcon;
export const ListTree = QueueListIcon;
export const Loader2 = ArrowPathIcon;
export const Loader2Icon = ArrowPathIcon;
export const Lock = LockClosedIcon;
export const LogOut = ArrowRightStartOnRectangleIcon;
export const Mail = EnvelopeIcon;
export const Map = MapIcon;
export { MapIcon };
export const MapPin = MapPinIcon;
export const Meh = FaceSmileIcon;
export const Menu = Bars3Icon;
export const MessageCircle = ChatBubbleOvalLeftIcon;
export const MessageSquare = ChatBubbleLeftIcon;
export const MessageSquareText = ChatBubbleLeftEllipsisIcon;
export const Mic = MicrophoneIcon;
export const Minus = MinusIcon;
export { MinusIcon };
export const Moon = MoonIcon;
export const MoreHorizontal = EllipsisHorizontalIcon;
export const MoreHorizontalIcon = EllipsisHorizontalIcon;
export const MoreVertical = EllipsisVerticalIcon;
export const MousePointerClick = CursorArrowRaysIcon;
export const Network = ShareIcon;
export const Palette = PaintBrushIcon;
export const PanelLeftIcon = Bars3BottomLeftIcon;
export const Paperclip = PaperClipIcon;
export const Pause = PauseIcon;
export const Pencil = PencilIcon;
export const Phone = PhoneIcon;
export const PhoneCall = PhoneArrowUpRightIcon;
export const PieChart = ChartPieIcon;
export const Play = PlayIcon;
export const PlayCircle = PlayCircleIcon;
export const Plug = PowerIcon;
export const Plug2 = PowerIcon;
export const Plus = PlusIcon;
export const Quote = ChatBubbleBottomCenterTextIcon;
export const Radio = RadioIcon;
export const RefreshCw = ArrowPathIcon;
export const Rocket = RocketLaunchIcon;
export const RotateCcw = ArrowUturnLeftIcon;
export const RotateCw = ArrowPathIcon;
export const Route = MapPinIcon;
export const Rows3 = Bars3Icon;
export const Rows4 = QueueListIcon;
export const Save = DocumentCheckIcon;
export const ScrollText = DocumentTextIcon;
export const Search = MagnifyingGlassIcon;
export const SearchIcon = MagnifyingGlassIcon;
export const Send = PaperAirplaneIcon;
export const Settings = Cog6ToothIcon;
export const Settings2 = AdjustmentsHorizontalIcon;
export const Share2 = ShareIcon;
export const Shield = ShieldCheckIcon;
export const ShieldCheck = ShieldCheckIcon;
export const Signal = SignalIcon;
export const SlidersHorizontal = AdjustmentsHorizontalIcon;
export const Smartphone = DevicePhoneMobileIcon;
export const Smile = FaceSmileIcon;
export const Sparkles = SparklesIcon;
export const Star = StarIcon;
export const StickyNote = BookmarkIcon;
export const Sun = SunIcon;
export const Sunrise = SunIcon;
export const TableProperties = TableCellsIcon;
export const Tag = TagIcon;
export const Target = ViewfinderCircleIcon;
export const Terminal = CommandLineIcon;
export const Thermometer = BeakerIcon;
export const Timer = ClockIcon;
export const Trash2 = TrashIcon;
export const TrendingDown = ArrowTrendingDownIcon;
export const TrendingUp = ArrowTrendingUpIcon;
export const TriangleAlert = ExclamationTriangleIcon;
export const Trophy = TrophyIcon;
export const Upload = ArrowUpTrayIcon;
export const UploadCloud = CloudArrowUpIcon;
export const User = UserIcon;
export const User2 = UserIcon;
export const UserCheck = UserPlusIcon;
export const UserCog = UserCircleIcon;
export const UserPlus = UserPlusIcon;
export const Users = UsersIcon;
export const Users2 = UsersIcon;
export const Video = VideoCameraIcon;
export const Wallet = WalletIcon;
export const Wand2 = SparklesIcon;
export const Webhook = ArrowsRightLeftIcon;
export const Wifi = WifiIcon;
export const Workflow = ArrowsRightLeftIcon;
export const X = XMarkIcon;
export const XCircle = XCircleIcon;
export const XIcon = XMarkIcon;
export const Zap = BoltIcon;
export const CloudDownload = CloudArrowUpIcon;
export const Percent = CurrencyDollarIcon;
export const CalendarCheck2 = CalendarDaysIcon;
export const ClipboardListIcon = ClipboardDocumentListIcon;

// Alguns nomes que aparecem mas correspondem direto a algo já exportado por nome —
// também re-exporto pro caso de uso em outros arquivos.
export {
  AcademicCapIcon,
  ArchiveBoxIcon,
  ArrowLeftEndOnRectangleIcon,
  BoltIcon,
  PhotoIcon,
  SparklesIcon,
  TrashIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
};
