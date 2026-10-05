"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT,
  DEALS_CRM_STATS_REFRESH_EVENT,
  openDealsLeadInline,
  useDealsInlineRefresh,
} from "@/lib/deals-events";
import { useRouter } from "next/navigation";
import CRMPageLayout from "@/components/crm/CRMPageLayout";
import LeadContactQuickActions from "@/components/crm/LeadContactQuickActions";
import { resolveLeadId, openLeadWhatsApp, openLeadEmail } from "@/lib/crm/leadContactActions";
import { resolveLeadEmail, resolveLeadPhone } from "@/lib/crm/resolveLeadContactInfo";
import {
  activityMatchesFollowUpSearch,
  buildActivitiesFollowUpsUrl,
} from "@/lib/crm/activitiesFollowUpsApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authenticatedFetch, getUserData } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { getOrgId, getUserDataFromToken } from "@/lib/auth";
import { getTeamMembers } from "@/lib/feed-api";
import { FOLLOW_UP_TASK_DEFAULTS } from "@/lib/crm/isFollowUpTask";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Users,
  User,
  TrendingUp,
  Percent,
  Bell,
  ChevronDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Phone,
  Presentation,
  MessageSquare,
  MoreHorizontal,
  Edit,
  FileEdit,
  Loader2,
  ChevronsUpDown,
  Plus,
  Check,
  Search,
  X,
} from "lucide-react";
import DashboardFollowUpCard, { toDisplayText as toActivityDisplayText } from "@/components/deals/DashboardFollowUpCard";
import { EditLeadProfileDialog } from "@/components/deals/EditLeadProfileDialog";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLeadNotifications } from "@/hooks/useLeadNotifications";
import { LeadNotificationSettings } from "@/components/crm/LeadNotificationSettings";
import { useTheme } from "next-themes";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { jwtDecode } from 'jwt-decode'

// Figma metric card icons (exact SVGs from design)
const IconTotalLeads = ({ className }: { className?: string }) => (
  <svg className={className} width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0.199972 6.40099C0.252493 6.44038 0.312259 6.46904 0.375857 6.48533C0.439455 6.50162 0.505639 6.50523 0.570631 6.49595C0.635622 6.48666 0.698149 6.46467 0.754641 6.43122C0.811132 6.39777 0.860483 6.35352 0.899874 6.301C1.20256 5.89742 1.59505 5.56985 2.04627 5.34424C2.49749 5.11864 2.99503 5.00118 3.49951 5.00118C4.00398 5.00118 4.50153 5.11864 4.95275 5.34424C5.40397 5.56985 5.79646 5.89742 6.09914 6.301C6.17879 6.40697 6.29727 6.47698 6.42852 6.49561C6.55977 6.51424 6.69305 6.47998 6.79905 6.40036C6.83683 6.37226 6.87031 6.33879 6.89841 6.301C7.20109 5.89742 7.59359 5.56985 8.0448 5.34424C8.49602 5.11864 8.99357 5.00118 9.49804 5.00118C10.0025 5.00118 10.5001 5.11864 10.9513 5.34424C11.4025 5.56985 11.795 5.89742 12.0977 6.301C12.1773 6.40707 12.2958 6.47716 12.4271 6.49585C12.5585 6.51455 12.6918 6.48031 12.7979 6.40067C12.904 6.32104 12.9741 6.20252 12.9927 6.07121C13.0114 5.93989 12.9772 5.80653 12.8976 5.70046C12.455 5.10721 11.8649 4.64012 11.1859 4.34565C11.5582 4.00578 11.819 3.56132 11.9341 3.07058C12.0492 2.57984 12.0133 2.06575 11.8311 1.5958C11.6488 1.12584 11.3287 0.721967 10.9128 0.43718C10.4969 0.152393 10.0046 0 9.50054 0C8.99648 0 8.50419 0.152393 8.08829 0.43718C7.67238 0.721967 7.35229 1.12584 7.17003 1.5958C6.98776 2.06575 6.95184 2.57984 7.06697 3.07058C7.1821 3.56132 7.4429 4.00578 7.81515 4.34565C7.32487 4.55765 6.87949 4.86115 6.50284 5.2399C6.12619 4.86115 5.6808 4.55765 5.19052 4.34565C5.56277 4.00578 5.82358 3.56132 5.93871 3.07058C6.05384 2.57984 6.01791 2.06575 5.83565 1.5958C5.65338 1.12584 5.33329 0.721967 4.91739 0.43718C4.50148 0.152393 4.0092 0 3.50513 0C3.00107 0 2.50878 0.152393 2.09288 0.43718C1.67697 0.721967 1.35688 1.12584 1.17462 1.5958C0.992354 2.06575 0.956428 2.57984 1.07156 3.07058C1.18669 3.56132 1.44749 4.00578 1.81974 4.34565C1.13775 4.63917 0.544736 5.10655 0.099986 5.70108C0.060595 5.7536 0.0319344 5.81337 0.0156409 5.87697C-0.000652568 5.94057 -0.00425998 6.00675 0.00502458 6.07174C0.0143091 6.13673 0.0363039 6.19926 0.0697531 6.25575C0.103202 6.31224 0.147451 6.36159 0.199972 6.40099ZM9.49867 1.00174C9.7953 1.00174 10.0853 1.0897 10.3319 1.2545C10.5785 1.4193 10.7708 1.65354 10.8843 1.92759C10.9978 2.20164 11.0275 2.5032 10.9696 2.79413C10.9118 3.08506 10.7689 3.35229 10.5592 3.56204C10.3494 3.77179 10.0822 3.91463 9.79126 3.9725C9.50033 4.03037 9.19877 4.00067 8.92472 3.88716C8.65067 3.77364 8.41644 3.58141 8.25164 3.33477C8.08684 3.08813 7.99888 2.79816 7.99888 2.50153C7.99888 2.10376 8.15689 1.72229 8.43816 1.44102C8.71942 1.15976 9.1009 1.00174 9.49867 1.00174ZM3.49951 1.00174C3.79614 1.00174 4.08611 1.0897 4.33275 1.2545C4.57939 1.4193 4.77162 1.65354 4.88513 1.92759C4.99865 2.20164 5.02835 2.5032 4.97048 2.79413C4.91261 3.08506 4.76977 3.35229 4.56002 3.56204C4.35027 3.77179 4.08303 3.91463 3.7921 3.9725C3.50117 4.03037 3.19962 4.00067 2.92556 3.88716C2.65151 3.77364 2.41728 3.58141 2.25248 3.33477C2.08768 3.08813 1.99972 2.79816 1.99972 2.50153C1.99972 2.10376 2.15773 1.72229 2.439 1.44102C2.72026 1.15976 3.10174 1.00174 3.49951 1.00174ZM11.1859 10.8447C11.5582 10.5049 11.819 10.0604 11.9341 9.56966C12.0492 9.07892 12.0133 8.56484 11.8311 8.09488C11.6488 7.62493 11.3287 7.22105 10.9128 6.93627C10.4969 6.65148 10.0046 6.49909 9.50054 6.49909C8.99648 6.49909 8.50419 6.65148 8.08829 6.93627C7.67238 7.22105 7.35229 7.62493 7.17003 8.09488C6.98776 8.56484 6.95184 9.07892 7.06697 9.56966C7.1821 10.0604 7.4429 10.5049 7.81515 10.8447C7.32487 11.0567 6.87949 11.3602 6.50284 11.739C6.12619 11.3602 5.6808 11.0567 5.19052 10.8447C5.56277 10.5049 5.82358 10.0604 5.93871 9.56966C6.05384 9.07892 6.01791 8.56484 5.83565 8.09488C5.65338 7.62493 5.33329 7.22105 4.91739 6.93627C4.50148 6.65148 4.0092 6.49909 3.50513 6.49909C3.00107 6.49909 2.50878 6.65148 2.09288 6.93627C1.67697 7.22105 1.35688 7.62493 1.17462 8.09488C0.992354 8.56484 0.956428 9.07892 1.07156 9.56966C1.18669 10.0604 1.44749 10.5049 1.81974 10.8447C1.13775 11.1383 0.544736 11.6056 0.099986 12.2002C0.060595 12.2527 0.0319344 12.3125 0.0156409 12.3761C-0.000652568 12.4397 -0.00425998 12.5058 0.00502458 12.5708C0.0143091 12.6358 0.0363039 12.6983 0.0697531 12.7548C0.103202 12.8113 0.147451 12.8607 0.199972 12.9001C0.252493 12.9395 0.312259 12.9681 0.375857 12.9844C0.439455 13.0007 0.505639 13.0043 0.570631 12.995C0.635622 12.9858 0.698149 12.9638 0.754641 12.9303C0.811132 12.8969 0.860483 12.8526 0.899874 12.8001C1.20256 12.3965 1.59505 12.0689 2.04627 11.8433C2.49749 11.6177 2.99503 11.5003 3.49951 11.5003C4.00398 11.5003 4.50153 11.6177 4.95275 11.8433C5.40397 12.0689 5.79646 12.3965 6.09914 12.8001C6.17879 12.9061 6.29727 12.9761 6.42852 12.9947C6.55977 13.0133 6.69305 12.9791 6.79905 12.8994C6.83683 12.8713 6.87031 12.8379 6.89841 12.8001C7.20109 12.3965 7.59359 12.0689 8.0448 11.8433C8.49602 11.6177 8.99357 11.5003 9.49804 11.5003C10.0025 11.5003 10.5001 11.6177 10.9513 11.8433C11.4025 12.0689 11.795 12.3965 12.0977 12.8001C12.1773 12.9062 12.2958 12.9763 12.4271 12.9949C12.5585 13.0136 12.6918 12.9794 12.7979 12.8998C12.904 12.8201 12.9741 12.7016 12.9927 12.5703C13.0114 12.439 12.9772 12.3056 12.8976 12.1995C12.455 11.6063 11.8649 11.1392 11.1859 10.8447ZM3.49951 7.50083C3.79614 7.50083 4.08611 7.58879 4.33275 7.75359C4.57939 7.91839 4.77162 8.15262 4.88513 8.42668C4.99865 8.70073 5.02835 9.00228 4.97048 9.29321C4.91261 9.58414 4.76977 9.85138 4.56002 10.0611C4.35027 10.2709 4.08303 10.4137 3.7921 10.4716C3.50117 10.5295 3.19962 10.4998 2.92556 10.3862C2.65151 10.2727 2.41728 10.0805 2.25248 9.83386C2.08768 9.58722 1.99972 9.29725 1.99972 9.00062C1.99972 8.60285 2.15773 8.22137 2.439 7.94011C2.72026 7.65884 3.10174 7.50083 3.49951 7.50083ZM9.49867 7.50083C9.7953 7.50083 10.0853 7.58879 10.3319 7.75359C10.5785 7.91839 10.7708 8.15262 10.8843 8.42668C10.9978 8.70073 11.0275 9.00228 10.9696 9.29321C10.9118 9.58414 10.7689 9.85138 10.5592 10.0611C10.3494 10.2709 10.0822 10.4137 9.79126 10.4716C9.50033 10.5295 9.19877 10.4998 8.92472 10.3862C8.65067 10.2727 8.41644 10.0805 8.25164 9.83386C8.08684 9.58722 7.99888 9.29725 7.99888 9.00062C7.99888 8.60285 8.15689 8.22137 8.43816 7.94011C8.71942 7.65884 9.1009 7.50083 9.49867 7.50083Z" fill="white"/>
  </svg>
);

const IconLeadsWon = ({ className }: { className?: string }) => (
  <svg className={className} width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.4083 11.2699C11.4954 9.69174 10.0887 8.56011 8.44702 8.02367C9.25908 7.54025 9.88999 6.80363 10.2429 5.92693C10.5958 5.05024 10.6511 4.08194 10.4004 3.17074C10.1497 2.25955 9.60686 1.45583 8.85518 0.883027C8.1035 0.310223 7.18458 0 6.23952 0C5.29447 0 4.37554 0.310223 3.62386 0.883027C2.87218 1.45583 2.32931 2.25955 2.07862 3.17074C1.82793 4.08194 1.88328 5.05024 2.23616 5.92693C2.58905 6.80363 3.21997 7.54025 4.03202 8.02367C2.39033 8.55952 0.983597 9.69114 0.0707481 11.2699C0.0372723 11.3245 0.0150681 11.3852 0.00544544 11.4485C-0.0041772 11.5118 -0.0010233 11.5764 0.0147211 11.6385C0.0304654 11.7005 0.0584813 11.7588 0.0971158 11.8099C0.13575 11.861 0.184221 11.9038 0.239667 11.9358C0.295114 11.9678 0.356413 11.9884 0.419949 11.9964C0.483485 12.0043 0.54797 11.9995 0.6096 11.9821C0.671229 11.9647 0.728755 11.9352 0.778783 11.8952C0.828811 11.8552 0.870328 11.8057 0.900883 11.7494C2.03011 9.79783 4.02603 8.63264 6.23952 8.63264C8.45302 8.63264 10.4489 9.79783 11.5782 11.7494C11.6087 11.8057 11.6502 11.8552 11.7003 11.8952C11.7503 11.9352 11.8078 11.9647 11.8694 11.9821C11.9311 11.9995 11.9956 12.0043 12.0591 11.9964C12.1226 11.9884 12.1839 11.9678 12.2394 11.9358C12.2948 11.9038 12.3433 11.861 12.3819 11.8099C12.4206 11.7588 12.4486 11.7005 12.4643 11.6385C12.4801 11.5764 12.4832 11.5118 12.4736 11.4485C12.464 11.3852 12.4418 11.3245 12.4083 11.2699ZM2.88302 4.31714C2.88302 3.65328 3.07987 3.00434 3.44869 2.45236C3.81751 1.90039 4.34172 1.47018 4.95504 1.21613C5.56836 0.962084 6.24325 0.895614 6.89434 1.02513C7.54544 1.15464 8.14351 1.47431 8.61293 1.94373C9.08234 2.41314 9.40202 3.01122 9.53153 3.66231C9.66104 4.31341 9.59457 4.98829 9.34053 5.60161C9.08648 6.21493 8.65627 6.73915 8.1043 7.10797C7.55232 7.47678 6.90338 7.67364 6.23952 7.67364C5.34961 7.67269 4.49643 7.31875 3.86717 6.68949C3.23791 6.06023 2.88397 5.20704 2.88302 4.31714Z" fill="white"/>
  </svg>
);

const IconConversionRate = ({ className }: { className?: string }) => (
  <svg className={className} width="15" height="11" viewBox="0 0 15 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.52563 3.90812C6.50486 3.84583 6.49656 3.78005 6.50121 3.71455C6.50586 3.64905 6.52337 3.58511 6.55274 3.52637C6.58211 3.46764 6.62276 3.41526 6.67237 3.37224C6.72198 3.32922 6.77958 3.29639 6.84188 3.27563L7.59188 3.02563C7.66704 3.00057 7.74708 2.99373 7.8254 3.00568C7.90373 3.01763 7.97809 3.04802 8.04237 3.09435C8.10664 3.14068 8.15898 3.20162 8.19508 3.27214C8.23118 3.34267 8.25001 3.42077 8.25 3.5V6C8.25 6.13261 8.19732 6.25979 8.10355 6.35355C8.00979 6.44732 7.88261 6.5 7.75 6.5C7.61739 6.5 7.49022 6.44732 7.39645 6.35355C7.30268 6.25979 7.25 6.13261 7.25 6V4.19375L7.15812 4.22437C7.09583 4.24514 7.03005 4.25344 6.96455 4.24879C6.89905 4.24414 6.83511 4.22663 6.77637 4.19726C6.71764 4.16789 6.66526 4.12724 6.62224 4.07763C6.57922 4.02802 6.54639 3.97042 6.52563 3.90812ZM15 10.5C15 10.6326 14.9473 10.7598 14.8536 10.8536C14.7598 10.9473 14.6326 11 14.5 11H0.5C0.367392 11 0.240215 10.9473 0.146447 10.8536C0.0526784 10.7598 0 10.6326 0 10.5C0 10.3674 0.0526784 10.2402 0.146447 10.1464C0.240215 10.0527 0.367392 10 0.5 10H1V4C1 3.73478 1.10536 3.48043 1.29289 3.29289C1.48043 3.10536 1.73478 3 2 3H4.5V1C4.5 0.734783 4.60536 0.48043 4.79289 0.292893C4.98043 0.105357 5.23478 0 5.5 0H9.5C9.76522 0 10.0196 0.105357 10.2071 0.292893C10.3946 0.48043 10.5 0.734783 10.5 1V5.5H13C13.2652 5.5 13.5196 5.60536 13.7071 5.79289C13.8946 5.98043 14 6.23478 14 6.5V10H14.5C14.6326 10 14.7598 10.0527 14.8536 10.1464C14.9473 10.2402 15 10.3674 15 10.5ZM10.5 6.5V10H13V6.5H10.5ZM5.5 10H9.5V1H5.5V10ZM2 10H4.5V4H2V10Z" fill="white"/>
  </svg>
);

const IconEstimatedRevenue = ({ className }: { className?: string }) => (
  <svg className={className} width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 0C5.21442 0 3.95772 0.381218 2.8888 1.09545C1.81988 1.80968 0.986756 2.82484 0.494786 4.01256C0.00281635 5.20028 -0.125905 6.50721 0.124899 7.76809C0.375703 9.02896 0.994768 10.1872 1.90381 11.0962C2.81285 12.0052 3.97104 12.6243 5.23192 12.8751C6.49279 13.1259 7.79973 12.9972 8.98745 12.5052C10.1752 12.0132 11.1903 11.1801 11.9046 10.1112C12.6188 9.04229 13 7.78558 13 6.5C12.9982 4.77665 12.3128 3.12441 11.0942 1.90582C9.8756 0.687224 8.22335 0.00181989 6.5 0ZM6.5 12C5.41221 12 4.34884 11.6774 3.44437 11.0731C2.5399 10.4687 1.83495 9.60975 1.41867 8.60476C1.00238 7.59977 0.893465 6.4939 1.10568 5.427C1.3179 4.36011 1.84173 3.3801 2.61092 2.61091C3.3801 1.84172 4.36011 1.3179 5.42701 1.10568C6.4939 0.893462 7.59977 1.00238 8.60476 1.41866C9.60976 1.83494 10.4687 2.53989 11.0731 3.44436C11.6774 4.34883 12 5.4122 12 6.5C11.9983 7.95818 11.4184 9.35617 10.3873 10.3873C9.35617 11.4184 7.95819 11.9983 6.5 12ZM9 7.75C9 8.21413 8.81563 8.65925 8.48744 8.98744C8.15925 9.31563 7.71413 9.5 7.25 9.5H7V10C7 10.1326 6.94732 10.2598 6.85356 10.3536C6.75979 10.4473 6.63261 10.5 6.5 10.5C6.36739 10.5 6.24022 10.4473 6.14645 10.3536C6.05268 10.2598 6 10.1326 6 10V9.5H5C4.86739 9.5 4.74022 9.44732 4.64645 9.35355C4.55268 9.25979 4.5 9.13261 4.5 9C4.5 8.86739 4.55268 8.74021 4.64645 8.64645C4.74022 8.55268 4.86739 8.5 5 8.5H7.25C7.44892 8.5 7.63968 8.42098 7.78033 8.28033C7.92098 8.13968 8 7.94891 8 7.75C8 7.55109 7.92098 7.36032 7.78033 7.21967C7.63968 7.07902 7.44892 7 7.25 7H5.75C5.28587 7 4.84075 6.81563 4.51257 6.48744C4.18438 6.15925 4 5.71413 4 5.25C4 4.78587 4.18438 4.34075 4.51257 4.01256C4.84075 3.68437 5.28587 3.5 5.75 3.5H6V3C6 2.86739 6.05268 2.74021 6.14645 2.64645C6.24022 2.55268 6.36739 2.5 6.5 2.5C6.63261 2.5 6.75979 2.55268 6.85356 2.64645C6.94732 2.74021 7 2.86739 7 3V3.5H8C8.13261 3.5 8.25979 3.55268 8.35356 3.64645C8.44732 3.74021 8.5 3.86739 8.5 4C8.5 4.13261 8.44732 4.25979 8.35356 4.35355C8.25979 4.44732 8.13261 4.5 8 4.5H5.75C5.55109 4.5 5.36033 4.57902 5.21967 4.71967C5.07902 4.86032 5 5.05109 5 5.25C5 5.44891 5.07902 5.63968 5.21967 5.78033C5.36033 5.92098 5.55109 6 5.75 6H7.25C7.71413 6 8.15925 6.18437 8.48744 6.51256C8.81563 6.84075 9 7.28587 9 7.75Z" fill="white"/>
  </svg>
);

const FIGMA_CARD_BORDER = "border border-[rgba(136,136,136,0.5)]";
const FIGMA_PANEL_CLASS = `bg-transparent ${FIGMA_CARD_BORDER} rounded-[10px] shadow-none`;

interface JwtPayload {
  // Adjust these fields according to YOUR actual JWT payload
  sub?: string        // user id
  name?: string
  email?: string
  role?: string
  exp?: number
  orgId?: string
  iat?: number
  userId?: string
  // ... add any custom claims like garageId, permissions, etc.
  [key: string]: any
}
// Core data types
interface Lead {
  _id: string;
  negotiatedPricing: string;
  isLeadWon: boolean;
}

interface Company {
  _id: string;
  name: string;
  industry?: string;
}

interface Activity {
  _id: string;
  type: "task" | "event" | "call";
  title: string;
  entityName: string;
  createdAt: string;
  dueDate?: string;
  status?: "completed" | "due" | "overdue";
}

interface PipelineStage {
  _id: string;
  name: string;
  leads: Lead[];
  totalValue: number;
  conversionRate: number;
}

interface FunnelStage {
  stage: string;
  leads: number;
  value: number;
  conversionRate?: number;
  color?: string;
}

interface AssignedUserFilterOption {
  id: string;
  name: string;
  email?: string;
}

interface ActivityFollowUp {
  _id?: string;
  leadId?: string;
  title?: string;
  type?: string;
  companyName?: string;
  entityName?: string;
  contactName?: string;
  assignedTo?: string;
  dueDate?: string;
  scheduledDate?: string;
  status?: string;
  stage?: string;
  priority?: string;
  notes?: string;
  createdAt?: string;
  lead?: string;
  leadDetails?: {
    stage?: string;
    [key: string]: any;
  };
  contacts?: Array<{
    firstName?: string;
    lastName?: string;
    name?: string;
    [key: string]: any;
  }>;
  firstName?: string;
  lastName?: string;
  name?: string;
  description?: string;
  [key: string]: any;
}

/** Funnel stage row for Edit Lead — value must be a string for Radix Select. */
interface EditFunnelStageOption {
  name: string;
  value: string;
}

type FollowUpSchedulePreview = {
  dueDates: Date[];
  intervalDays: number;
  usingDefaultPattern: boolean;
  error?: string;
};

function normalizeLeadStageValue(stage: unknown): string {
  if (stage == null) return "";
  if (typeof stage === "string") return stage.trim();
  if (typeof stage === "object" && !Array.isArray(stage)) {
    const o = stage as Record<string, unknown>;
    const pick = o.name ?? o.stageName ?? o.value ?? o.stage;
    if (typeof pick === "string") return pick.trim();
    if (pick != null) return String(pick).trim();
  }
  return "";
}

/** Backend may use funnelStage (FunnelFlow), funnelStages, or stages. */
function normalizeFunnelStagesFromApi(funnel: any): EditFunnelStageOption[] {
  const raw = funnel?.funnelStage ?? funnel?.funnelStages ?? funnel?.stages ?? [];
  if (!Array.isArray(raw)) return [];
  const out: EditFunnelStageOption[] = [];
  raw.forEach((item: any) => {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push({ name: s, value: s });
      return;
    }
    const name = String(item?.name ?? item?.stageName ?? "").trim();
    const value = String(item?.value ?? item?.name ?? item?.stageName ?? "").trim();
    const label = name || value;
    if (!label) return;
    out.push({ name: label, value: value || label });
  });
  return out;
}

function resolveInitialStageForSelect(
  leadStageRaw: unknown,
  options: EditFunnelStageOption[]
): string {
  const fromLead = normalizeLeadStageValue(leadStageRaw);
  if (options.length === 0) return fromLead;
  if (!fromLead) return options[0].value;
  const lower = fromLead.toLowerCase();
  for (const opt of options) {
    if (opt.value.toLowerCase() === lower || opt.name.toLowerCase() === lower) {
      return opt.value;
    }
  }
  for (const opt of options) {
    const nv = opt.name.toLowerCase();
    const vv = opt.value.toLowerCase();
    if (lower.includes(nv) || nv.includes(lower) || lower.includes(vv) || vv.includes(lower)) {
      return opt.value;
    }
  }
  return options[0].value;
}

function buildFollowUpSchedulePreview(
  nextFollowUp: string,
  followUpIntervalDays: string,
  autoFollowUpEndDate: string
): FollowUpSchedulePreview {
  if (!nextFollowUp) {
    return { dueDates: [], intervalDays: 2, usingDefaultPattern: true };
  }

  const intervalInput = parseInt(followUpIntervalDays, 10);
  const intervalDays = Number.isFinite(intervalInput) && intervalInput > 0 ? intervalInput : 2;
  const usingDefaultPattern = !followUpIntervalDays?.trim() && !autoFollowUpEndDate;

  const startDate = new Date(`${nextFollowUp}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    return {
      dueDates: [],
      intervalDays,
      usingDefaultPattern,
      error: "Please select a valid follow-up date",
    };
  }

  let endDate: Date | null = null;
  if (autoFollowUpEndDate) {
    const parsedEndDate = new Date(`${autoFollowUpEndDate}T00:00:00`);
    if (Number.isNaN(parsedEndDate.getTime())) {
      return {
        dueDates: [],
        intervalDays,
        usingDefaultPattern,
        error: "Please select a valid end date",
      };
    }
    endDate = parsedEndDate;
  }

  if (endDate && endDate < startDate) {
    return {
      dueDates: [],
      intervalDays,
      usingDefaultPattern,
      error: "End date cannot be before next follow-up date",
    };
  }

  const dueDates: Date[] = [];
  const cursorDate = new Date(startDate);
  if (endDate) {
    while (cursorDate <= endDate) {
      dueDates.push(new Date(cursorDate));
      cursorDate.setDate(cursorDate.getDate() + intervalDays);
    }
  } else {
    for (let i = 0; i < 3; i += 1) {
      dueDates.push(new Date(cursorDate));
      cursorDate.setDate(cursorDate.getDate() + intervalDays);
    }
  }

  return { dueDates, intervalDays, usingDefaultPattern };
}

function isActivityFollowUpCompleted(activity: ActivityFollowUp): boolean {
  if (activity.isCompleted === true || activity.isCompleted === "true") return true;
  const status = (activity.status || "").toLowerCase();
  return status === "completed" || status === "done";
}

function parseActivityTimestamp(value: unknown): number {
  if (!value) return 0;
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Local calendar day of due date — keeps Jul 30 before Jul 31 in all tabs. */
function getActivityDueDayTimestamp(activity: ActivityFollowUp): number {
  const due = activity.dueDate || activity.scheduledDate || activity.createdAt;
  if (!due) return 0;
  const day = new Date(String(due));
  if (Number.isNaN(day.getTime())) return 0;
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function getActivityDueDayKey(activity: ActivityFollowUp): string {
  const ts = getActivityDueDayTimestamp(activity);
  if (!ts) return "";
  const day = new Date(ts);
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatFollowUpDayChipLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  return `${day}${suffix} ${month}`;
}

/** Section divider label e.g. "30 JUL" */
function formatDaySectionLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  return `${day} ${month}`;
}

/** Prefer task update time so recently contacted / edited follow-ups float within a day. */
function getActivityLastUpdatedTimestamp(activity: ActivityFollowUp): number {
  const leadDetails = (activity.leadDetails || {}) as Record<string, unknown>;
  const candidates = [
    activity.updatedAt,
    activity.lastContactedAt,
    activity.lastContact,
    activity.createdAt,
    leadDetails.lastActivity,
    leadDetails.lastContact,
    leadDetails.last_activity,
    leadDetails.last_contact,
    leadDetails.updatedAt,
    leadDetails.updated_at,
  ];
  const fromFields = Math.max(0, ...candidates.map(parseActivityTimestamp));
  if (fromFields) return fromFields;

  // Mongo ObjectId embeds creation time — last resort when API omits timestamps
  const id = String(activity._id || "");
  if (/^[a-f0-9]{24}$/i.test(id)) {
    return parseInt(id.slice(0, 8), 16) * 1000;
  }
  return 0;
}

/**
 * All tabs (Today / Next 7 Days / Overdue):
 * 1) due date ascending — earliest day first (30 Jul, then 31 Jul, …)
 * 2) within the same day — most recently updated / contacted first
 */
function sortFollowUpActivities(
  items: ActivityFollowUp[],
  dueOrder: "asc" | "desc" = "asc"
): ActivityFollowUp[] {
  return [...items].sort((a, b) => {
    const dueA = getActivityDueDayTimestamp(a);
    const dueB = getActivityDueDayTimestamp(b);
    const dueDiff = dueOrder === "asc" ? dueA - dueB : dueB - dueA;
    if (dueDiff !== 0) return dueDiff;
    return getActivityLastUpdatedTimestamp(b) - getActivityLastUpdatedTimestamp(a);
  });
}

/** Same shape as initial dashboard load — must run after any activities-followups refetch or card titles / lead links break. */
function normalizeActivitiesFollowUpsList(activitiesData: unknown): ActivityFollowUp[] {
  const list = Array.isArray(activitiesData) ? activitiesData : [];
  return list.map((activity: any) => {
    let contactName = "";
    if (activity.leadDetails?.contacts && Array.isArray(activity.leadDetails.contacts) && activity.leadDetails.contacts.length > 0) {
      const firstContact = activity.leadDetails.contacts[0];
      const firstName = firstContact.firstName || "";
      const lastName = firstContact.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName && fullName.length < 50 && !/^[a-f0-9]{20,}$/i.test(fullName)) {
        contactName = fullName;
      } else if (firstContact.name && firstContact.name.length < 50 && !/^[a-f0-9]{20,}$/i.test(firstContact.name)) {
        contactName = firstContact.name;
      }
    }
    if (!contactName && activity.contacts && activity.contacts.length > 0) {
      const firstContact = activity.contacts[0];
      const firstName = firstContact.firstName || "";
      const lastName = firstContact.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName && fullName.length < 50 && !/^[a-f0-9]{20,}$/i.test(fullName)) {
        contactName = fullName;
      } else if (firstContact.name && firstContact.name.length < 50 && !/^[a-f0-9]{20,}$/i.test(firstContact.name)) {
        contactName = firstContact.name;
      }
    }
    if (!contactName) {
      const fallbackName = activity.contactName || activity.assignedTo || "";
      contactName =
        fallbackName && fallbackName.length < 50 && !/^[a-f0-9]{20,}$/i.test(fallbackName) ? fallbackName : "";
    }

    const titleFromLead =
      activity.leadDetails?.leadName ||
      activity.leadDetails?.name ||
      activity.leadDetails?.companyName ||
      activity.leadName ||
      "";

    const normalized: ActivityFollowUp = {
      ...activity,
      title: activity.title || titleFromLead || activity.companyName || activity.entityName || activity.subject || "Follow-up",
      stage: activity.leadDetails?.stage || activity.stage,
      contactName,
      leadId: activity.leadId || activity.lead || activity._id,
    };
    const completed = isActivityFollowUpCompleted(normalized);
    return {
      ...normalized,
      isCompleted: completed,
      status: completed ? "completed" : normalized.status || "open",
    };
  });
}

export default function CRMDashboardPage() {
  // Initialize lead notifications
  const leadNotifications = useLeadNotifications();
  const { theme, resolvedTheme: nextResolvedTheme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  /** Matches CRM shell / inline deals — avoids white modals when `theme` is still hydrating or document is .dark */
  const dashboardTheme =
    theme === "color"
      ? "color"
      : theme === "dark" || isInlineDealsMode || nextResolvedTheme === "dark"
        ? "dark"
        : "light";

  /** Activities & Followup segmented control — matches Figma filter-tabs (3203:1250) */
  const activitiesFilterTabsListClass =
    theme === "color"
      ? "flex h-9 w-full items-stretch rounded-[12px] bg-[rgba(255,255,255,0.03)] p-0.5"
      : "flex h-[35px] w-full items-stretch rounded-[20px] bg-[#121215] border border-[#888] p-[4px]";

  const activitiesFilterTabTriggerClass =
    theme === "color"
      ? "h-full min-w-0 flex-1 rounded-[12px] border-0 px-0 py-0 text-[12px] font-bold leading-none text-white shadow-none outline-none transition-colors cursor-pointer inline-flex items-center justify-center gap-[6px] data-[state=active]:border-[0.667px] data-[state=active]:border-transparent data-[state=active]:!bg-[#0ff] data-[state=active]:!text-[#0a0e27] data-[state=active]:shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
      : "h-full min-w-0 flex-1 rounded-[16px] border-0 px-0 py-0 text-[12px] font-medium leading-none text-[#6b7280] shadow-none outline-none transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-[6px] data-[state=active]:!bg-[#888] data-[state=active]:!text-white";

  // Deals dashboard is dark by design (except explicit "color" theme).
  const isDealsDarkTheme = dashboardTheme !== "color";

  const editLeadFormSurfaceClass =
    isDealsDarkTheme
      ? "[&_[data-slot='input']]:bg-[#111111] [&_[data-slot='input']]:border-[#3a3a3a] [&_[data-slot='input']]:text-[#e5e5e5] [&_[data-slot='input']]:placeholder:text-[#7c7c7c] [&_[data-slot='textarea']]:bg-[#111111] [&_[data-slot='textarea']]:border-[#3a3a3a] [&_[data-slot='textarea']]:text-[#e5e5e5] [&_[data-slot='textarea']]:placeholder:text-[#7c7c7c] [&_[data-slot='select-trigger']]:bg-[#111111] [&_[data-slot='select-trigger']]:border-[#3a3a3a] [&_[data-slot='select-trigger']]:text-[#e5e5e5] [&_[role='combobox']]:bg-[#111111] [&_[role='combobox']]:border-[#3a3a3a] [&_[role='combobox']]:text-[#e5e5e5]"
      : dashboardTheme === "color"
        ? "[&_[data-slot='input']]:bg-[rgba(255,255,255,0.04)] [&_[data-slot='input']]:border-[rgba(0,255,255,0.2)] [&_[data-slot='input']]:text-white [&_[data-slot='input']]:placeholder:text-[rgba(0,255,255,0.45)] [&_[data-slot='textarea']]:bg-[rgba(255,255,255,0.04)] [&_[data-slot='textarea']]:border-[rgba(0,255,255,0.2)] [&_[data-slot='textarea']]:text-white [&_[data-slot='textarea']]:placeholder:text-[rgba(0,255,255,0.45)] [&_[data-slot='select-trigger']]:bg-[rgba(255,255,255,0.04)] [&_[data-slot='select-trigger']]:border-[rgba(0,255,255,0.2)] [&_[data-slot='select-trigger']]:text-white [&_[role='combobox']]:bg-[rgba(255,255,255,0.04)] [&_[role='combobox']]:border-[rgba(0,255,255,0.2)] [&_[role='combobox']]:text-white"
        : "";

  const router = useRouter();
  const openLeadFromActivity = useCallback((leadId?: string) => {
    if (!leadId) return;
    if (openDealsLeadInline(String(leadId))) return;
    router.push(`/deals/leads/${leadId}`);
  }, [router]);

  const openLeadsListPopup = useCallback(async (type: "active" | "won", page: number = 1) => {
    setLeadsListType(type);
    setLeadsListStageName("");
    setLeadsListSearch("");
    setIsLeadsListOpen(true);
    setIsLeadsListLoading(true);
    setLeadsListData([]);
    try {
      const status = type === "active" ? "active" : "won";
      const skip = (page - 1) * LEADS_LIST_PAGE_SIZE;
      const res = await authenticatedFetch(
        buildExternalUrl(`/crm/leads?leadStatus=${status}&skip=${skip}&limit=${LEADS_LIST_PAGE_SIZE}`),
        { method: "GET" }
      );
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      const leads = Array.isArray(data) ? data : data?.leads ?? data?.data ?? [];
      const total = data?.total ?? data?.pagination?.total ?? leads.length;
      setLeadsListData(leads);
      setLeadsListPage(page);
      setLeadsListTotalCount(total);
      setLeadsListTotalPages(Math.max(1, Math.ceil(total / LEADS_LIST_PAGE_SIZE)));
    } catch (err) {
      console.error(`Error fetching ${type} leads:`, err);
      toast.error(`Failed to load ${type} leads`);
      setLeadsListTotalPages(1);
      setLeadsListPage(1);
      setLeadsListTotalCount(0);
    } finally {
      setIsLeadsListLoading(false);
    }
  }, []);

  const openStageLeadsPopup = useCallback(async (stageName: string, page: number = 1) => {
    if (!stageName) return;
    setLeadsListType("stage");
    setLeadsListStageName(stageName);
    setLeadsListSearch("");
    setIsLeadsListOpen(true);
    setIsLeadsListLoading(true);
    setLeadsListData([]);
    try {
      const skip = (page - 1) * LEADS_LIST_PAGE_SIZE;
      const res = await authenticatedFetch(
        buildExternalUrl(`/crm/leads?stage=${encodeURIComponent(stageName)}&skip=${skip}&limit=${LEADS_LIST_PAGE_SIZE}`),
        { method: "GET" }
      );
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      const leads = Array.isArray(data) ? data : data?.leads ?? data?.data ?? [];
      const total = data?.total ?? data?.pagination?.total ?? leads.length;
      setLeadsListData(leads);
      setLeadsListPage(page);
      setLeadsListTotalCount(total);
      setLeadsListTotalPages(Math.max(1, Math.ceil(total / LEADS_LIST_PAGE_SIZE)));
    } catch (err) {
      console.error(`Error fetching leads for stage ${stageName}:`, err);
      toast.error(`Failed to load leads for ${stageName}`);
      setLeadsListTotalPages(1);
      setLeadsListPage(1);
      setLeadsListTotalCount(0);
    } finally {
      setIsLeadsListLoading(false);
    }
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    leadCount: 0,
    leadsWon: 0,
    leadsWonValue: 0,
    companyCount: 0,
    conversionRate: 0,
    periodGrowth: 0,
  });
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [selectedFunnelFilter, setSelectedFunnelFilter] = useState("all");
  const [isFunnelDropdownOpen, setIsFunnelDropdownOpen] = useState(false);
  const [funnelSearchTerm, setFunnelSearchTerm] = useState("");
  const [showAllStages, setShowAllStages] = useState(false);
  const [activitiesFollowUps, setActivitiesFollowUps] = useState<ActivityFollowUp[]>([]);
  const [activitiesSearchInput, setActivitiesSearchInput] = useState("");
  const [activitiesSearchQuery, setActivitiesSearchQuery] = useState("");
  const [isActivitiesSearchLoading, setIsActivitiesSearchLoading] = useState(false);
  const [selectedNext7DaysDay, setSelectedNext7DaysDay] = useState<string>("all");
  const next7DaysListRef = useRef<HTMLDivElement | null>(null);
  const next7DaysChipsRef = useRef<HTMLDivElement | null>(null);
  const [selectedOverdueDay, setSelectedOverdueDay] = useState<string>("all");
  const overdueListRef = useRef<HTMLDivElement | null>(null);
  const overdueChipsRef = useRef<HTMLDivElement | null>(null);
  const [assignedUsersFilter, setAssignedUsersFilter] = useState<AssignedUserFilterOption[]>([]);
  const [selectedAssignedUserId, setSelectedAssignedUserId] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isCustomDatesOpen, setIsCustomDatesOpen] = useState(false);

  // Edit Follow-up Modal State
  const [isEditFollowUpOpen, setIsEditFollowUpOpen] = useState(false);
  const [editFollowUpData, setEditFollowUpData] = useState<{
    _id: string;
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    status: string;
  }>({
    _id: "",
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    status: "open",
  });
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  // Edit Lead Modal State
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [isEditAutoFollowUpConfigOpen, setIsEditAutoFollowUpConfigOpen] = useState(false);
  const [isAutoFollowUpDialogOpen, setIsAutoFollowUpDialogOpen] = useState(false);
  const [autoFollowUpLeadId, setAutoFollowUpLeadId] = useState<string | null>(null);
  const [autoFollowUpConfig, setAutoFollowUpConfig] = useState({
    enableAutoFollowUp: true,
    followUpIntervalDays: "2",
    autoFollowUpEndDate: "",
    title: "",
    description: "",
  });
  const [isSavingAutoFollowUp, setIsSavingAutoFollowUp] = useState(false);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const initialEditLeadForm = {
    leadName: "",
    contactId: "",
    phone: "",
    initialStage: "Prospects",
    source: "",
    notes: "",
    description: "",
    companyId: "",
    email: "",
    salesFunnelId: "",
    estimatedValue: "0",
    assignedTo: "",
    priority: "",
    nextFollowUp: "",
    followUpIntervalDays: "",
    autoFollowUpEndDate: "",
    estimatedClose: "",
    tags: "",
    autoFollowUp: false,
  };
  const [editLeadForm, setEditLeadForm] = useState({ ...initialEditLeadForm });
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isLoadingLead, setIsLoadingLead] = useState(false);
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [customSourceValue, setCustomSourceValue] = useState("");
  const [editLeadTags, setEditLeadTags] = useState<string[]>([]);
  const [editLeadStatus, setEditLeadStatus] = useState("active");

  // Leads List Popup State (Active Leads / Won Leads / Stage Leads)
  const [isLeadsListOpen, setIsLeadsListOpen] = useState(false);
  const [leadsListType, setLeadsListType] = useState<"active" | "won" | "stage">("active");
  const [leadsListStageName, setLeadsListStageName] = useState("");
  const [leadsListData, setLeadsListData] = useState<any[]>([]);
  const [isLeadsListLoading, setIsLeadsListLoading] = useState(false);
  const [leadsListPage, setLeadsListPage] = useState(1);
  const [leadsListTotalPages, setLeadsListTotalPages] = useState(1);
  const [leadsListTotalCount, setLeadsListTotalCount] = useState(0);
  const [leadsListSearch, setLeadsListSearch] = useState("");
  const LEADS_LIST_PAGE_SIZE = 20;

  // Helper functions for lead popup (matching leads list)
  const getLeadName = (lead: any) => lead.leadName || "--";

  const getOwnerDetails = (lead: any) => {
    const assignedUsers = lead.assignedUsers || lead.assignedUser || lead.assignedToUsers || lead.assigned;
    if (assignedUsers && Array.isArray(assignedUsers) && assignedUsers.length > 0) {
      const user = assignedUsers[0];
      const name = user.name || user.userName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
      return { name };
    }
    if (lead.owner?.name) return { name: lead.owner.name };
    if (lead.owner?.firstName) return { name: `${lead.owner.firstName} ${lead.owner.lastName || ""}`.trim() };
    if (lead.assignedTo && typeof lead.assignedTo === "object" && lead.assignedTo.name) return { name: lead.assignedTo.name };
    return { name: "Unassigned" };
  };

  const getTags = (lead: any): string[] => {
    if (Array.isArray(lead.tags)) return lead.tags.filter((tag: any) => tag && String(tag).trim() !== "");
    return [];
  };

  const getTagColor = (index: number) => {
    const colors = [
      { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", text: "#3b82f6" },
      { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)", text: "#10b981" },
      { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", text: "#f59e0b" },
      { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)", text: "#8b5cf6" },
      { bg: "rgba(236,72,153,0.1)", border: "rgba(236,72,153,0.2)", text: "#ec4899" },
      { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", text: "#ef4444" },
      { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", text: "#22c55e" },
      { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.2)", text: "#a855f7" },
    ];
    return colors[index % colors.length];
  };

  const getStageColorForPopup = (stage: string | any) => {
    let stageStr = "";
    if (typeof stage === "string") stageStr = stage;
    else if (typeof stage === "object") stageStr = stage?.name || stage?.stage || stage?.stageName || "";
    if (!stageStr) return "bg-[rgba(107,114,128,0.1)] text-[#6b7280]";
    const s = stageStr.toLowerCase();
    switch (s) {
      case "proposal": return "bg-[rgba(123,104,238,0.1)] text-[#7b68ee]";
      case "qualified": return "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]";
      case "negotiation": return "bg-[rgba(236,72,153,0.1)] text-[#ec4899]";
      case "prospects": case "prospect": return "bg-[rgba(59,130,246,0.1)] text-[#3b82f6]";
      case "discovery": return "bg-[rgba(34,197,94,0.1)] text-[#22c55e]";
      case "closed-won": case "closed won": case "closed": return "bg-[rgba(34,197,94,0.1)] text-[#22c55e]";
      case "closed-lost": case "closed lost": return "bg-[rgba(239,68,68,0.1)] text-[#ef4444]";
      case "lead": return "bg-[rgba(99,102,241,0.1)] text-[#6366f1]";
      case "awareness": return "bg-[rgba(6,182,212,0.1)] text-[#06b6d4]";
      case "interest": return "bg-[rgba(16,185,129,0.1)] text-[#10b981]";
      case "consideration": return "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]";
      case "intent": return "bg-[rgba(139,92,246,0.1)] text-[#8b5cf6]";
      case "evaluation": return "bg-[rgba(14,165,233,0.1)] text-[#0ea5e9]";
      default: return "bg-[rgba(107,114,128,0.1)] text-[#6b7280]";
    }
  };

  const getStageStringForPopup = (stage: string | any): string => {
    if (stage == null) return "-";
    if (typeof stage === "string") { const t = stage.trim(); return t === "" ? "-" : t; }
    const stageName = stage?.name ?? stage?.stage ?? stage?.stageName;
    if (stageName != null && typeof stageName === "string") { const t = String(stageName).trim(); return t === "" ? "-" : t; }
    return "-";
  };

  const getNextFollowUpForPopup = (lead: any): string => {
    if (lead.nextFollowUp) {
      try {
        const d = new Date(lead.nextFollowUp);
        if (!isNaN(d.getTime())) return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
      } catch { }
    }
    return "-";
  };

  // Dropdown Data State for Edit Lead
  interface ContactOption { id: string; name: string; email: string; phoneNumber: string; companyName?: string; raw: any; }
  interface CompanyOption { id: string; name: string; industry?: string; raw: any; }
  interface OwnerOption { id: string; name: string; email?: string; raw: any; _id?: string; userId?: string; }

  const [editContacts, setEditContacts] = useState<ContactOption[]>([]);
  const [editCompanies, setEditCompanies] = useState<CompanyOption[]>([]);
  const [editOwners, setEditOwners] = useState<OwnerOption[]>([]);
  const [editFunnels, setEditFunnels] = useState<any[]>([]);
  const [editFunnelStages, setEditFunnelStages] = useState<EditFunnelStageOption[]>([]);
  const [editSources] = useState<string[]>([
    "Website",
    "Referral",
    "Cold Call",
    "LinkedIn",
    "Event",
    "Email Campaign",
    "Facebook",
    "Facebook Lead Ads",
    "Google Ads",
    "WhatsApp",
  ]);
  const [isEditContactComboOpen, setIsEditContactComboOpen] = useState(false);
  const [isEditCompanyComboOpen, setIsEditCompanyComboOpen] = useState(false);
  const [isEditOwnerComboOpen, setIsEditOwnerComboOpen] = useState(false);
  const [editContactSearchTerm, setEditContactSearchTerm] = useState("");
  const [editCompanySearchTerm, setEditCompanySearchTerm] = useState("");
  const [editOwnerSearchTerm, setEditOwnerSearchTerm] = useState("");
  const [selectedEditContact, setSelectedEditContact] = useState<ContactOption | null>(null);
  const [selectedEditCompany, setSelectedEditCompany] = useState<CompanyOption | null>(null);
  const [selectedEditOwner, setSelectedEditOwner] = useState<OwnerOption | null>(null);
  const [isEditContactsLoading, setIsEditContactsLoading] = useState(false);
  const [isEditCompaniesLoading, setIsEditCompaniesLoading] = useState(false);
  const [isEditOwnersLoading, setIsEditOwnersLoading] = useState(false);
  const [isEditFunnelsLoading, setIsEditFunnelsLoading] = useState(false);
  const [isEditStagesLoading, setIsEditStagesLoading] = useState(false);
  const [editOrganizationId, setEditOrganizationId] = useState<string>("");

  // Helper functions for dropdown options
  const toContactOption = (c: any): ContactOption | null => {
    if (!c) return null;
    const id = c._id || c.id;
    if (!id) return null;
    const name = c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
    return { id: String(id), name, email: c.email || "", phoneNumber: c.phoneNumber || c.phone || c.mobile || "", companyName: c.companyName || "", raw: c };
  };
  const toCompanyOption = (c: any): CompanyOption | null => {
    if (!c) return null;
    const id = c._id || c.id;
    if (!id) return null;
    return { id: String(id), name: c.companyName || c.name || "Unknown", industry: c.industry, raw: c };
  };
  const toOwnerOption = (u: any): OwnerOption | null => {
    if (!u) return null;
    const id = u._id || u.id || u.userId;
    if (!id) return null;
    const name = u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Unknown";
    return { id: String(id), name, email: u.email, raw: u, _id: u._id, userId: u.userId };
  };
  const formatDateForInput = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0];
    } catch { return ""; }
  };

  const splitPhoneNumbers = (value: string): string[] =>
    (value || "")
      .split(/[,\n;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const isValidPhoneNumberEntry = (value: string): boolean => {
    if (/[^0-9\s()+-]/.test(value)) return false;
    const digitsOnly = value.replace(/\D/g, "");
    const isValidLocal10 = digitsOnly.length === 10;
    const isValidIndiaWithCountryCode = digitsOnly.length === 12 && digitsOnly.startsWith("91");
    return isValidLocal10 || isValidIndiaWithCountryCode;
  };

  useEffect(() => {
    const userData = localStorage.getItem("garage_tok")

    if (userData) {
      const payload = jwtDecode<JwtPayload>(userData)
      console.log("payload", payload)
      // setDecoded(payload)
      try {
        if (payload?.orgId) {

          setEditOrganizationId(payload?.orgId || "");
        }

      } catch (error) {
        console.error("Error parsing userData:", error)
        setEditOrganizationId("")
      }
    }
  }, [])

  // Load organization ID for owner search
  // useEffect(() => {
  //    const userData = localStorage.getItem("garage_tok");
  //   if (!userData) return;
  //   try {
  //     const parsed = JSON.parse(userData);
  //     setEditOrganizationId(parsed.organizationId || "");
  //   } catch { setEditOrganizationId(""); }
  // }, []);

  // Function to check authentication status
  // const checkAuthStatus = () => {
  //   const authToken = Cookies.get("auth-token");
  //   const userData = getUserData();

  //   console.log("Auth Status Check:");
  //   console.log("Auth Token:", authToken ? "Present" : "Missing");
  //   console.log("User Data:", userData ? "Present" : "Missing");

  //   if (userData) {
  //     console.log("User Info:", userData);
  //   }

  //   return { authToken, userData };
  // };

  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  console.log(companies, activities);

  const refreshCrmDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDebugInfo("Starting fetch...");

    try {
      // Check authentication status
      const currentUserData = getUserData();
      // Log user data for debugging
      console.log("User data:", currentUserData);

      // Fetch essential data
      // Using Promise.allSettled to handle partial failures
      const assignedToParam =
        selectedAssignedUserId && selectedAssignedUserId !== "all"
          ? `?assignedTo=${encodeURIComponent(selectedAssignedUserId)}`
          : "";
      const leadsUrl = buildExternalUrl(`crm/leads/count${assignedToParam}`);
      const activitiesUrl = buildExternalUrl(
        buildActivitiesFollowUpsUrl("crm/activities-followups", {
          assignedTo: selectedAssignedUserId,
          search: activitiesSearchQuery,
        })
      );
      const assignedUsersUrl = buildExternalUrl("crm/leads/assigned-users");

      setDebugInfo(prev => prev + `\nFetching: ${leadsUrl}`);

      const [leadsCountRes, activitiesFollowUpsRes, assignedUsersRes] =
        await Promise.allSettled([
          authenticatedFetch(leadsUrl),
          authenticatedFetch(activitiesUrl),
          authenticatedFetch(assignedUsersUrl),
        ]);

      // Process leads count
      let leadsCountData: Record<string, unknown> = {};
      if (leadsCountRes.status === 'fulfilled') {
        try {
          leadsCountData = await leadsCountRes.value.json();
          setDebugInfo(prev => prev + `\nLeads API Success: ${JSON.stringify(leadsCountData).substring(0, 100)}...`);
        } catch (e) {
          console.error("Error parsing leads JSON:", e);
          setDebugInfo(prev => prev + `\nLeads JSON Parse Error: ${e}`);
        }
      } else {
        console.error('Leads API failed:', leadsCountRes.reason);
        setDebugInfo(prev => prev + `\nLeads API Failed: ${leadsCountRes.reason}`);
        setError(`Leads API Failed: ${leadsCountRes.reason}`);
      }

      // Process activities
      let activitiesFollowUpsData: { data?: unknown; activities?: unknown; followups?: unknown;[key: string]: unknown } = {};
      if (activitiesFollowUpsRes.status === 'fulfilled') {
        try {
          activitiesFollowUpsData = await activitiesFollowUpsRes.value.json();
        } catch (e) {
          console.error("Error parsing activities JSON:", e);
        }
      } else {
        console.error('Activities API failed:', activitiesFollowUpsRes.reason);
      }

      // Process assigned users for filter dropdown
      if (assignedUsersRes.status === "fulfilled") {
        try {
          const assignedUsersData = await assignedUsersRes.value.json();
          const assignedUsersList =
            assignedUsersData?.data?.users ||
            assignedUsersData?.data?.assignedUsers ||
            assignedUsersData?.users ||
            assignedUsersData?.assignedUsers ||
            assignedUsersData?.data ||
            [];

          if (Array.isArray(assignedUsersList)) {
            const mapped = assignedUsersList
              .map((u: any) => {
                const id = u?._id || u?.id || u?.userId;
                if (!id) return null;
                const name =
                  u?.name ||
                  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
                  u?.email ||
                  "Unknown";
                return {
                  id: String(id),
                  name,
                  email: u?.email || "",
                } as AssignedUserFilterOption;
              })
              .filter(Boolean) as AssignedUserFilterOption[];

            const deduped = Array.from(
              new Map(mapped.map((item) => [item.id, item])).values()
            );
            setAssignedUsersFilter(deduped);
          } else {
            setAssignedUsersFilter([]);
          }
        } catch (e) {
          console.error("Error parsing assigned users JSON:", e);
        }
      } else {
        console.error("Assigned users API failed:", assignedUsersRes.reason);
      }

      console.log("API Response Data:");
      console.log("Leads Count:", leadsCountData);

      console.log("Activities Follow-ups:", activitiesFollowUpsData);

      // Process leads count data
      // Check if data is nested in 'data' dictionary or at top level
      let leadsCountResponse: Record<string, unknown> = leadsCountData;

      // If the object has a 'data' property that is an object, use that. 
      // Otherwise assume the top level object is the data.
      if (leadsCountData && typeof leadsCountData === 'object' && 'data' in leadsCountData && leadsCountData.data && typeof leadsCountData.data === 'object') {
        leadsCountResponse = leadsCountData.data as Record<string, unknown>;
      }

      console.log("Processed leadsCountResponse:", leadsCountResponse);

      // First card: Use totalPricing from API
      const totalRevenue = Number(leadsCountResponse?.['totalPricing'] ?? 0);

      // Second card: Use count (total leads) from API
      const leadCount = Number(leadsCountResponse?.['count'] ?? 0);

      // Third card: Use leadswon from API (handle both casing variations)
      const leadsWon = Number(leadsCountResponse?.['leadswon'] ?? leadsCountResponse?.['leadsWon'] ?? 0);
      const leadsWonValue = Number(leadsCountResponse?.['totalWonPricing'] ?? 0);

      // Fourth card: Calculate conversion rate as (leadsWon / count) * 100
      const conversionRate = leadCount > 0 ? Math.round((leadsWon / leadCount) * 100 * 100) / 100 : 0;

      const periodGrowth = Number(leadsCountResponse?.['periodGrowth'] ?? leadsCountResponse?.['growthPercentage'] ?? 0);

      // Process funnel data from stageBreakdown array
      const stageBreakdown = (Array.isArray(leadsCountResponse?.['stageBreakdown']) ? leadsCountResponse['stageBreakdown'] : []) as unknown[];

      // Define stage colors mapping - comprehensive list of variations
      const stageColorMap: Record<string, string> = {
        // Prospects variations
        'prospects': '#eab308',
        'prospect': '#eab308',
        'new': '#eab308',
        'lead': '#eab308',
        'sales pre reach': '#eab308',
        'sales pre-reach': '#eab308',
        // Qualified variations
        'qualified': '#8b5cf6',
        'qualify': '#8b5cf6',
        'qualification': '#8b5cf6',
        'warm leads': '#8b5cf6',
        'warm': '#8b5cf6',
        // Proposal variations
        'proposal': '#ef4444',
        'proposals': '#ef4444',
        'quoted': '#ef4444',
        'quote': '#ef4444',
        'negotiations': '#ef4444',
        // Negotiation variations
        'negotiation': '#ef4444',
        'negotiate': '#ef4444',
        'negotiating': '#ef4444',
        // Closed Won variations
        'closed won': '#6b7280',
        'closedwon': '#6b7280',
        'closed-won': '#6b7280',
        'won': '#6b7280',
        'closed': '#6b7280',
        'completed': '#6b7280',
        'leads won': '#6b7280',
      };


      // Function to get color for a stage
      const getStageColor = (stageName: any, index: number): string => {
        if (!stageName) {
          // Default colors by position if no name
          const defaultColors = ['#7b68ee', '#a78bfa', '#ec4899', '#f59e0b', '#10b981'];
          return defaultColors[index % defaultColors.length];
        }

        // Ensure stageName is a string
        const stageStr = String(stageName);
        const stageLower = stageStr.toLowerCase().trim();

        // Try exact match first
        if (stageColorMap[stageLower]) {
          return stageColorMap[stageLower];
        }

        // Try partial match - check if stage name contains any key
        for (const [key, color] of Object.entries(stageColorMap)) {
          if (stageLower.includes(key) || key.includes(stageLower)) {
            return color;
          }
        }

        // Default colors by position (fallback)
        const defaultColors = ['#7b68ee', '#a78bfa', '#ec4899', '#f59e0b', '#10b981'];
        return defaultColors[index % defaultColors.length];
      };

      const funnelStages = stageBreakdown.map((stage: any, index: number) => {
        const stageName = stage.stage || "";
        return {
          stage: stageName,
          leads: stage.leadsCount || stage.leads || 0,
          value: stage.totalPricing || stage.value || 0,
          color: stage.color || getStageColor(stageName, index),
          conversionRate: 0, // Will be calculated if needed
        };
      });
      setFunnelData(funnelStages);

      // Process activities and follow-ups
      const activitiesData = activitiesFollowUpsData.data || activitiesFollowUpsData.activities || activitiesFollowUpsData.followups || activitiesFollowUpsData || [];
      const normalizedActivities = normalizeActivitiesFollowUpsList(
        Array.isArray(activitiesData) ? activitiesData : []
      );
      setActivitiesFollowUps(
        activitiesSearchQuery
          ? normalizedActivities.filter((a) =>
            activityMatchesFollowUpSearch(
              a as unknown as Record<string, unknown>,
              activitiesSearchQuery
            )
          )
          : normalizedActivities
      );

      setStats({
        totalRevenue,
        leadCount,
        leadsWon,
        leadsWonValue,
        companyCount: 0,
        conversionRate,
        periodGrowth,
      });
    } catch (error) {
      console.error("Error fetching CRM data:", error);
      // setError(error instanceof Error ? error.message : "Failed to fetch CRM data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAssignedUserId, activitiesSearchQuery]);

  const refetchActivitiesFollowUps = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        buildExternalUrl(
          buildActivitiesFollowUpsUrl("crm/activities-followups", {
            assignedTo: selectedAssignedUserId,
            search: activitiesSearchQuery,
          })
        )
      );
      if (!res.ok) return false;
      const data = await res.json();
      const activitiesData =
        data.data || data.activities || data.followups || data || [];
      const normalized = normalizeActivitiesFollowUpsList(
        Array.isArray(activitiesData) ? activitiesData : []
      );
      const filtered = activitiesSearchQuery
        ? normalized.filter((a) =>
          activityMatchesFollowUpSearch(
            a as unknown as Record<string, unknown>,
            activitiesSearchQuery
          )
        )
        : normalized;
      setActivitiesFollowUps(filtered);
      return true;
    } catch (error) {
      console.error("Error refetching activities follow-ups:", error);
      return false;
    }
  }, [selectedAssignedUserId, activitiesSearchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActivitiesSearchQuery(activitiesSearchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activitiesSearchInput]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsActivitiesSearchLoading(true);
      await refetchActivitiesFollowUps();
      if (!cancelled) setIsActivitiesSearchLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activitiesSearchQuery, selectedAssignedUserId, refetchActivitiesFollowUps]);

  useEffect(() => {
    void refreshCrmDashboardData();
  }, [refreshCrmDashboardData]);

  useEffect(() => {
    const handler = () => {
      void refreshCrmDashboardData();
      window.setTimeout(() => {
        void refetchActivitiesFollowUps();
      }, 1200);
    };
    window.addEventListener(DEALS_CRM_STATS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(DEALS_CRM_STATS_REFRESH_EVENT, handler);
  }, [refreshCrmDashboardData, refetchActivitiesFollowUps]);

  useEffect(() => {
    const handler = (event: Event) => {
      const activity = (event as CustomEvent<{ activity?: Record<string, unknown> }>)
        .detail?.activity;
      if (!activity) return;
      const [normalized] = normalizeActivitiesFollowUpsList([activity]);
      if (!normalized?._id) return;
      setActivitiesFollowUps((prev) => {
        const leadId = normalized.leadId;
        const withoutLead = leadId
          ? prev.filter((a) => a.leadId !== leadId)
          : prev.filter((a) => a._id !== normalized._id);
        if (withoutLead.some((a) => a._id === normalized._id)) return withoutLead;
        return [
          ...withoutLead,
          {
            ...normalized,
            createdAt: normalized.createdAt || new Date().toISOString(),
          },
        ];
      });
    };
    window.addEventListener(DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT, handler);
    return () =>
      window.removeEventListener(DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT, handler);
  }, []);

  useDealsInlineRefresh("dashboard", refreshCrmDashboardData);

  // Removed unused formatCurrency function

  // Function to render skeleton loading placeholder
  const SkeletonLoader = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-muted ${className}`} />
  );

  // Helper function to categorize activities by date
  // Each bucket is sorted: earliest due day first, then latest updated within that day
  const categorizeActivitiesByDate = (activities: ActivityFollowUp[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next7End = new Date(today);
    next7End.setDate(next7End.getDate() + 7);

    const todayActivities: ActivityFollowUp[] = [];
    const next7DaysActivities: ActivityFollowUp[] = [];
    const pastDueActivities: ActivityFollowUp[] = [];

    activities.forEach((activity) => {
      // Skip completed activities so they don't show up in Overdue/Today/Upcoming
      if (isActivityFollowUpCompleted(activity)) return;

      const dueDate = activity.dueDate || activity.scheduledDate || activity.createdAt;
      if (!dueDate) return;

      const activityDate = new Date(dueDate);
      activityDate.setHours(0, 0, 0, 0);

      if (activityDate.getTime() === today.getTime()) {
        todayActivities.push(activity);
      } else if (activityDate < today) {
        pastDueActivities.push(activity);
      } else if (activityDate <= next7End) {
        // Only future tasks within the next 7 days (today excluded — that goes to Today)
        next7DaysActivities.push(activity);
      }
      // Tasks beyond 7 days are omitted from these tabs
    });

    return {
      // All tabs: earliest due day first; within each day, latest updated on top
      today: sortFollowUpActivities(todayActivities, "asc"),
      next7Days: sortFollowUpActivities(next7DaysActivities, "asc"),
      pastDue: sortFollowUpActivities(pastDueActivities, "asc"),
    };
  };

  // Helper function to format activity time
  const formatActivityTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Helper function to format activity date
  const formatActivityDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const categorizedActivities = categorizeActivitiesByDate(activitiesFollowUps);

  const next7DaysDayOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const activity of categorizedActivities.next7Days) {
      const key = getActivityDueDayKey(activity);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, count]) => ({
        dayKey,
        count,
        label: formatFollowUpDayChipLabel(dayKey),
      }));
  }, [categorizedActivities.next7Days]);

  const overdueDayOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const activity of categorizedActivities.pastDue) {
      const key = getActivityDueDayKey(activity);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, count]) => ({
        dayKey,
        count,
        label: formatFollowUpDayChipLabel(dayKey),
      }));
  }, [categorizedActivities.pastDue]);

  useEffect(() => {
    if (selectedNext7DaysDay === "all") return;
    const stillExists = next7DaysDayOptions.some((d) => d.dayKey === selectedNext7DaysDay);
    if (!stillExists) setSelectedNext7DaysDay("all");
  }, [next7DaysDayOptions, selectedNext7DaysDay]);

  useEffect(() => {
    if (selectedOverdueDay === "all") return;
    const stillExists = overdueDayOptions.some((d) => d.dayKey === selectedOverdueDay);
    if (!stillExists) setSelectedOverdueDay("all");
  }, [overdueDayOptions, selectedOverdueDay]);

  const scrollToDaySection = useCallback(
    (
      dayKey: string,
      setSelected: (key: string) => void,
      chipsRef: React.RefObject<HTMLDivElement | null>,
      listRef: React.RefObject<HTMLDivElement | null>
    ) => {
      setSelected(dayKey);

      const chip = chipsRef.current?.querySelector(
        `[data-day-chip="${dayKey}"]`
      ) as HTMLElement | null;
      chip?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          const container = listRef.current;
          if (!container) return;

          if (dayKey === "all") {
            container.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }

          const section = container.querySelector(
            `[data-followup-day="${dayKey}"]`
          ) as HTMLElement | null;
          if (!section) return;

          const containerRect = container.getBoundingClientRect();
          const sectionRect = section.getBoundingClientRect();
          const nextTop =
            container.scrollTop + (sectionRect.top - containerRect.top) - 6;

          container.scrollTo({
            top: Math.max(0, nextTop),
            behavior: "smooth",
          });
        }, 40);
      });
    },
    []
  );

  const scrollToNext7DaySection = useCallback(
    (dayKey: string) =>
      scrollToDaySection(dayKey, setSelectedNext7DaysDay, next7DaysChipsRef, next7DaysListRef),
    [scrollToDaySection]
  );

  const scrollToOverdueDaySection = useCallback(
    (dayKey: string) =>
      scrollToDaySection(dayKey, setSelectedOverdueDay, overdueChipsRef, overdueListRef),
    [scrollToDaySection]
  );

  const dayChipButtonClass = (isActive: boolean) =>
    `shrink-0 h-[28px] px-[10px] rounded-[14px] text-[11px] font-semibold border transition-colors ${
      isActive
        ? theme === "color"
          ? "bg-[rgba(0,255,255,0.15)] border-[rgba(0,255,255,0.5)] text-[rgba(0,255,255,0.95)]"
          : "bg-[#2a2a2a] border-[#8b7aff] text-white"
        : theme === "color"
          ? "bg-transparent border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.65)] hover:bg-[rgba(0,255,255,0.08)]"
          : "bg-transparent border-[#3a3a3a] text-[#9ca3af] hover:bg-[#1e1e1e] hover:text-white"
    }`;

  const getActivitiesEmptyMessage = (tabLabel: string) =>
    activitiesSearchQuery
      ? `No matches in ${tabLabel} for "${activitiesSearchQuery}"`
      : `No activities for ${tabLabel}`;

  const getAssignedUserNameForActivity = (activity: ActivityFollowUp): string => {
    const assignedToDetails = Array.isArray((activity as any)?.assignedToDetails)
      ? (activity as any).assignedToDetails
      : [];
    const assignedToDetailsName =
      assignedToDetails[0]?.name ||
      [assignedToDetails[0]?.firstName, assignedToDetails[0]?.lastName].filter(Boolean).join(" ").trim() ||
      "";

    const explicitName =
      assignedToDetailsName ||
      (activity as any)?.assignedToName ||
      (activity as any)?.assignedUserName ||
      (activity as any)?.assignedToDetail?.name ||
      (activity as any)?.assignedUser?.name ||
      (activity as any)?.assignedToUser?.name ||
      "";
    if (explicitName && typeof explicitName === "string") {
      return explicitName.trim();
    }

    const assignedToValue = (activity as any)?.assignedTo;
    const assignedToId =
      (typeof assignedToValue === "object" && assignedToValue
        ? assignedToValue?._id || assignedToValue?.id || assignedToValue?.userId
        : typeof assignedToValue === "string"
          ? assignedToValue
          : "") || "";

    if (assignedToId) {
      const match = assignedUsersFilter.find((u) => u.id === String(assignedToId));
      if (match?.name) return match.name;

      if (
        typeof assignedToValue === "string" &&
        !/^[a-f0-9]{20,}$/i.test(assignedToValue) &&
        assignedToValue.trim().length > 0
      ) {
        return assignedToValue.trim();
      }
    }

    return "";
  };

  const handleAutoFollowUpDialogCancel = () => {
    setIsAutoFollowUpDialogOpen(false);
    setAutoFollowUpLeadId(null);
    setAutoFollowUpConfig({
      enableAutoFollowUp: true,
      followUpIntervalDays: "2",
      autoFollowUpEndDate: "",
      title: "",
      description: "",
    });
  };

  const handleAutoFollowUpDialogSave = async () => {
    if (!autoFollowUpLeadId) return;
    if (!autoFollowUpConfig.enableAutoFollowUp) {
      toast.error("Please enable auto follow-up");
      return;
    }
    setIsSavingAutoFollowUp(true);
    const loadingToast = toast.loading("Starting auto follow-up...");
    try {
      const userData = localStorage.getItem("garage_tok");
      let userId = "";
      let organizationId = "";

      if (userData) {
        try {
          const parsedData = jwtDecode<JwtPayload>(userData);
          userId = parsedData.userId || parsedData.id || "";
          organizationId = parsedData?.orgId || "";
        } catch (e) {
          console.error("Error parsing user data:", e);
        }
      }

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const dueDateTime = new Date(`${yyyy}-${mm}-${dd}T23:59:59`).toISOString();

      await authenticatedFetch(buildExternalUrl("/crm/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: autoFollowUpLeadId,
          title: autoFollowUpConfig.title.trim() || "Follow-up with Lead",
          description: autoFollowUpConfig.description.trim() || "Follow-up scheduled",
          dueDate: dueDateTime,
          priority: "medium",
          status: "open",
          assignedTo: userId,
          organizationId,
          createdBy: userId,
          ...FOLLOW_UP_TASK_DEFAULTS,
        }),
      });

      const body: Record<string, unknown> = {
        autoFollowUp: true,
      };
      const parsedInterval = parseInt(autoFollowUpConfig.followUpIntervalDays, 10);
      if (Number.isFinite(parsedInterval) && parsedInterval > 0) {
        body.followUpIntervalDays = parsedInterval;
      }
      if (autoFollowUpConfig.autoFollowUpEndDate) {
        body.autoFollowUpEndDate = autoFollowUpConfig.autoFollowUpEndDate;
      }
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/leads/${autoFollowUpLeadId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (response.ok) {
        toast.success("Auto follow-up started!", { id: loadingToast });
        setActivitiesFollowUps((prev) =>
          prev.map((a) =>
            a.leadId === autoFollowUpLeadId ? { ...a, isAutoFollowUp: true } : a
          )
        );
        setIsAutoFollowUpDialogOpen(false);
        setAutoFollowUpLeadId(null);
      } else {
        toast.error("Failed to start auto follow-up", { id: loadingToast });
      }
    } catch {
      toast.error("Failed to start auto follow-up", { id: loadingToast });
    } finally {
      setIsSavingAutoFollowUp(false);
    }
  };

  const renderFollowUpActivities = (
    items: ActivityFollowUp[],
    emptyTabLabel: string,
    options?: { groupByDate?: boolean }
  ) => {
    if (isLoading) {
      return (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} className="h-[88px] w-full" />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div
          className={`text-center py-4 text-[12px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280]"}`}
        >
          {getActivitiesEmptyMessage(emptyTabLabel)}
        </div>
      );
    }

    const renderCard = (activity: ActivityFollowUp) => {
      const contactName = toActivityDisplayText(activity.contactName);
      const assignedUserName = getAssignedUserNameForActivity(activity);
      const leadName =
        contactName ||
        assignedUserName ||
        toActivityDisplayText(activity.leadDetails?.leadName) ||
        toActivityDisplayText(activity.leadName) ||
        toActivityDisplayText(activity.leadDetails?.name) ||
        toActivityDisplayText(activity.companyName) ||
        toActivityDisplayText(activity.entityName) ||
        "Unknown";

      const leadData = activity.leadDetails as Record<string, unknown> | undefined;
      const leadPhone = resolveLeadPhone(leadData) || "";
      const leadEmail = resolveLeadEmail(leadData) || "";

      const handleWhatsApp = () => {
        if (leadData) {
          openLeadWhatsApp(leadData, {
            leadId: activity.leadId,
            onSuccess: () => {
              void refetchActivitiesFollowUps();
            },
          });
        }
      };

      const handleEmail = () => {
        if (leadData) {
          openLeadEmail(leadData);
        }
      };

      const handleEditLead = () => {
        void handleOpenEditLead(activity);
      };

      const handleEditFollowUp = () => {
        handleOpenEditFollowUp(activity);
      };

      const handleStartAutoFollowUp = () => {
        const leadId = activity.leadId;
        if (!leadId) return;
        setAutoFollowUpLeadId(leadId);
        setAutoFollowUpConfig({
          enableAutoFollowUp: true,
          followUpIntervalDays: "2",
          autoFollowUpEndDate: "",
          title: "",
          description: "",
        });
        setIsAutoFollowUpDialogOpen(true);
      };

      return (
        <DashboardFollowUpCard
          key={activity._id || `${activity.title}-${activity.dueDate}`}
          activity={activity}
          leadName={leadName}
          leadId={activity.leadId}
          leadPhone={leadPhone}
          leadEmail={leadEmail}
          onClick={() => openLeadFromActivity(activity.leadId)}
          onWhatsApp={handleWhatsApp}
          onEmail={handleEmail}
          onEditLead={handleEditLead}
          onEditFollowUp={handleEditFollowUp}
          onStartAutoFollowUp={handleStartAutoFollowUp}
          showDate={false}
        />
      );
    };

    if (!options?.groupByDate) {
      return <>{items.map(renderCard)}</>;
    }

    const groups: { dayKey: string; items: ActivityFollowUp[] }[] = [];
    for (const activity of items) {
      const dayKey = getActivityDueDayKey(activity) || "unknown";
      const last = groups[groups.length - 1];
      if (last && last.dayKey === dayKey) {
        last.items.push(activity);
      } else {
        groups.push({ dayKey, items: [activity] });
      }
    }

    const lineClass =
      theme === "color" ? "bg-[rgba(0,255,255,0.25)]" : "bg-[#3a3a3a]";
    const labelClass =
      theme === "color" ? "text-[rgba(0,255,255,0.75)]" : "text-[#9ca3af]";

    return (
      <div className="flex flex-col gap-[10px]">
        {groups.map((group) => (
          <div
            key={group.dayKey}
            data-followup-day={group.dayKey}
            className="flex flex-col gap-[10px] scroll-mt-2"
          >
            <div className="flex items-center gap-3 pt-1">
              <div className={`h-px flex-1 ${lineClass}`} />
              <span
                className={`shrink-0 text-[11px] font-semibold tracking-[0.08em] uppercase ${labelClass}`}
              >
                {group.dayKey === "unknown"
                  ? "No date"
                  : formatDaySectionLabel(group.dayKey)}
              </span>
              <div className={`h-px flex-1 ${lineClass}`} />
            </div>
            {group.items.map(renderCard)}
          </div>
        ))}
      </div>
    );
  };

  // Open Edit Follow-up modal
  const handleOpenEditFollowUp = (activity: ActivityFollowUp) => {
    let dueDateValue = "";
    const rawDate = activity.dueDate || activity.scheduledDate;
    if (rawDate) {
      try {
        const date = new Date(rawDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        dueDateValue = `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch { dueDateValue = ""; }
    }
    const completed = isActivityFollowUpCompleted(activity);
    setEditFollowUpData({
      _id: activity._id || "",
      title: activity.title || "",
      description: activity.description || activity.notes || "",
      dueDate: dueDateValue,
      priority: (activity.priority || "medium").toLowerCase(),
      status: completed ? "completed" : activity.status || "open",
    });
    setIsEditFollowUpOpen(true);
  };

  // Save Follow-up edits
  const handleSaveFollowUp = async () => {
    if (!editFollowUpData._id) return;
    setIsSavingFollowUp(true);
    const loadingToast = toast.loading("Saving follow-up...");
    const isNowCompleted = editFollowUpData.status?.toLowerCase() === "completed";
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/tasks/${editFollowUpData._id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editFollowUpData.title,
            description: editFollowUpData.description,
            dueDate: editFollowUpData.dueDate ? new Date(editFollowUpData.dueDate).toISOString() : undefined,
            priority: editFollowUpData.priority,
            status: editFollowUpData.status,
            isCompleted: isNowCompleted,
          }),
        }
      );
      if (response.ok) {
        toast.success("Follow-up updated!", { id: loadingToast });
        setIsEditFollowUpOpen(false);
        // Optimistic UI: remove completed items from Today/Next 7/Overdue lists immediately
        setActivitiesFollowUps((prev) => {
          if (isNowCompleted) {
            return prev.filter((a) => a._id !== editFollowUpData._id);
          }
          return prev.map((a) =>
            a._id === editFollowUpData._id
              ? {
                ...a,
                title: editFollowUpData.title,
                description: editFollowUpData.description,
                dueDate: editFollowUpData.dueDate
                  ? new Date(editFollowUpData.dueDate).toISOString()
                  : a.dueDate,
                priority: editFollowUpData.priority,
                status: editFollowUpData.status,
                isCompleted: false,
              }
              : a
          );
        });
        await refetchActivitiesFollowUps();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || "Failed to update follow-up", { id: loadingToast });
      }
    } catch (error) {
      console.error("Error saving follow-up:", error);
      toast.error("Failed to update follow-up", { id: loadingToast });
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Fetch funnel stages for selected funnel (returns normalized options for Select values)
  const fetchEditFunnelStages = async (funnelId: string): Promise<EditFunnelStageOption[]> => {
    if (!funnelId) {
      setEditFunnelStages([]);
      return [];
    }
    setIsEditStagesLoading(true);
    try {
      const res = await authenticatedFetch(buildExternalUrl(`/crm/funnels/${funnelId}`), { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        const funnel = data.funnel || data.data || data;
        const list = normalizeFunnelStagesFromApi(funnel);
        setEditFunnelStages(list);
        return list;
      }
    } catch (e) {
      console.error("Error fetching funnel stages:", e);
    } finally {
      setIsEditStagesLoading(false);
    }
    setEditFunnelStages([]);
    return [];
  };

  // Handle funnel change in edit modal — reload stages and set a valid Select value
  const handleEditFunnelChange = (funnelId: string) => {
    void (async () => {
      setEditLeadForm((prev) => ({ ...prev, salesFunnelId: funnelId }));
      const stages = await fetchEditFunnelStages(funnelId);
      if (stages.length > 0) {
        setEditLeadForm((prev) => ({ ...prev, initialStage: stages[0].value }));
      } else {
        setEditLeadForm((prev) => ({ ...prev, initialStage: "" }));
      }
    })();
  };

  // Open Edit Lead modal — loads all dropdown data and pre-fills the form
  const handleOpenEditLead = async (activity: ActivityFollowUp) => {
    const leadId =
      (typeof activity.leadId === "string"
        ? activity.leadId
        : (activity as any)?.leadId?._id || (activity as any)?.leadId?.id) ||
      (typeof activity.lead === "string"
        ? activity.lead
        : (activity as any)?.lead?._id || (activity as any)?.lead?.id) ||
      (activity as any)?.leadDetails?._id ||
      "";
    if (!leadId) {
      toast.error("No lead associated with this follow-up");
      return;
    }
    setIsLoadingLead(true);
    setIsEditLeadOpen(true);
    setEditLeadId(leadId);
    setEditLeadForm({ ...initialEditLeadForm });
    setEditLeadTags([]);
    setEditLeadStatus("active");
    setIsCustomSource(false);
    setCustomSourceValue("");
    setSelectedEditContact(null);
    setSelectedEditCompany(null);
    setSelectedEditOwner(null);
    setEditFunnelStages([]);

    // Load lead details as required request; aux dropdowns are best-effort.
    try {
      const leadRes = await authenticatedFetch(
        buildExternalUrl(`/crm/leads/${leadId}`),
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );

      const orgId = getOrgId() || getUserDataFromToken().orgId || editOrganizationId || "";
      const [contactsReq, companiesReq, funnelsReq, ownersReq] = await Promise.allSettled([
        authenticatedFetch(buildExternalUrl("/crm/contacts?skip=0&limit=50"), { method: "GET" }),
        authenticatedFetch(buildExternalUrl("/crm/companies?skip=0&limit=50"), { method: "GET" }),
        authenticatedFetch(buildExternalUrl("/crm/funnels"), { method: "GET" }),
        orgId
          ? getTeamMembers(orgId).catch(async () => {
              const res = await authenticatedFetch(
                buildExternalUrl(`/crm/organization-users?organizationId=${orgId}&limit=1000`),
                { method: "GET" }
              );
              if (!res.ok) throw new Error("owners failed");
              const data = await res.json();
              return data?.users || data?.members || data?.data?.users || data?.data?.members || data?.data || [];
            })
          : Promise.resolve([]),
      ]);

      const contactsRes = contactsReq.status === "fulfilled" ? contactsReq.value : null;
      const companiesRes = companiesReq.status === "fulfilled" ? companiesReq.value : null;
      const funnelsRes = funnelsReq.status === "fulfilled" ? funnelsReq.value : null;
      const ownersList =
        ownersReq.status === "fulfilled" && Array.isArray(ownersReq.value)
          ? ownersReq.value
          : [];

      // Parse contacts
      if (contactsRes?.ok) {
        const cData = await contactsRes.json();
        const cList = cData.contacts || cData.data || cData || [];
        setEditContacts((Array.isArray(cList) ? cList : []).map(toContactOption).filter(Boolean) as ContactOption[]);
      }

      // Parse companies
      if (companiesRes?.ok) {
        const coData = await companiesRes.json();
        const coList = coData.companies || coData.data || coData || [];
        setEditCompanies((Array.isArray(coList) ? coList : []).map(toCompanyOption).filter(Boolean) as CompanyOption[]);
      }

      // Parse funnels (keep local list for ID/name resolution below)
      let mappedFunnels: any[] = [];
      if (funnelsRes?.ok) {
        const fData = await funnelsRes.json();
        const fList = fData.funnels || fData.data || fData || [];
        mappedFunnels = (Array.isArray(fList) ? fList : [])
          .map((f: any) => ({
            ...f,
            _id: String(f?._id || f?.id || ""),
          }))
          .filter((f: any) => f._id);
        setEditFunnels(mappedFunnels);
      }
      // Parse owners (workspace-scoped team members)
      if (ownersList.length > 0) {
        setEditOwners(ownersList.map(toOwnerOption).filter(Boolean) as OwnerOption[]);
      }

      // Parse lead data
      if (!leadRes.ok) {
        toast.error("Failed to load lead data");
        setIsEditLeadOpen(false);
        return;
      }

      const data = await leadRes.json();
      const lead = data.lead || data.data || data;

      // Extract contact
      const contactSource = lead.contact || (lead.contacts && lead.contacts.length > 0 ? lead.contacts[0] : null);
      const contactId = lead.contactId || contactSource?.id || contactSource?._id || "";
      if (contactSource && contactId) {
        const opt = toContactOption(contactSource);
        if (opt) {
          setSelectedEditContact(opt);
          setEditContacts(prev => prev.some(c => c.id === opt.id) ? prev : [...prev, opt]);
        }
      }

      // Extract company
      const companySource = lead.company || (lead.companies && lead.companies.length > 0 ? lead.companies[0] : null);
      const companyId = lead.companyId || companySource?.id || companySource?._id || "";
      if (companySource && companyId) {
        const opt = toCompanyOption(companySource);
        if (opt) {
          setSelectedEditCompany(opt);
          setEditCompanies(prev => prev.some(c => c.id === opt.id) ? prev : [...prev, opt]);
        }
      }

      // Extract owner
      const ownerSource =
        (Array.isArray(lead.assignedUsers) && lead.assignedUsers.length > 0 ? lead.assignedUsers[0] : undefined) ||
        (typeof lead.assignedTo === 'object' && !Array.isArray(lead.assignedTo) ? lead.assignedTo : undefined) ||
        lead.owner;
      const assignedToId =
        (Array.isArray(lead.assignedTo) && lead.assignedTo.length > 0 ? (typeof lead.assignedTo[0] === 'string' ? lead.assignedTo[0] : lead.assignedTo[0]?._id) : undefined) ||
        (typeof lead.assignedTo === 'string' ? lead.assignedTo : undefined) ||
        ownerSource?._id || ownerSource?.id || "";
      if (ownerSource) {
        const opt = toOwnerOption(ownerSource);
        if (opt) {
          setSelectedEditOwner(opt);
          setEditOwners(prev => prev.some(o => o.id === opt.id) ? prev : [...prev, opt]);
        }
      }

      // Extract funnel ID and load stages.
      // API often puts the funnel *name* in `salesFunnel` (e.g. "Sales funnel") and the real
      // ObjectId in `funnelId` / `funnel.id` — only treat a string as an ID if it looks like one.
      const asObjectId = (v: unknown): string =>
        typeof v === "string" && /^[a-f0-9]{24}$/i.test(v.trim()) ? v.trim() : "";
      const rawSalesFunnel = lead.salesFunnel ?? (lead as any).salesFunnel;
      let salesFunnelId =
        asObjectId(lead.salesFunnelId) ||
        asObjectId((lead as any).salesFunnelID) ||
        asObjectId((lead as any).funnelId) ||
        asObjectId((lead as any).funnel?._id) ||
        asObjectId((lead as any).funnel?.id) ||
        asObjectId(typeof rawSalesFunnel === "object" ? rawSalesFunnel?._id : undefined) ||
        asObjectId(typeof rawSalesFunnel === "object" ? rawSalesFunnel?.id : undefined) ||
        asObjectId(typeof rawSalesFunnel === "string" ? rawSalesFunnel : undefined) ||
        asObjectId(typeof (lead as any).funnel === "string" ? (lead as any).funnel : undefined) ||
        "";

      // Resolve by name when API only gave a display name (same as lead detail page)
      if (!salesFunnelId && mappedFunnels.length > 0) {
        const nameHint = (
          (typeof rawSalesFunnel === "object" && (rawSalesFunnel?.name || rawSalesFunnel?.funnelName)) ||
          (typeof rawSalesFunnel === "string" ? rawSalesFunnel : "") ||
          (lead as any).funnel?.name ||
          ""
        )
          .toString()
          .trim()
          .toLowerCase();
        if (nameHint) {
          const byName = mappedFunnels.find((f) => {
            const name = String(f.name || f.funnelName || "").trim().toLowerCase();
            return name === nameHint;
          });
          if (byName) salesFunnelId = byName._id;
        }
      }

      let stageOptions: EditFunnelStageOption[] = [];
      // Prefer embedded funnel.stages when present (avoids a failed fetch on a name-as-id)
      if ((lead as any).funnel?.stages) {
        stageOptions = normalizeFunnelStagesFromApi((lead as any).funnel);
        if (stageOptions.length > 0) setEditFunnelStages(stageOptions);
      }
      if (salesFunnelId) {
        const fetched = await fetchEditFunnelStages(salesFunnelId);
        if (fetched.length > 0) stageOptions = fetched;
      }
      const resolvedInitialStage = resolveInitialStageForSelect(lead.stage, stageOptions);

      const phoneCandidates = [
        ...(Array.isArray((lead as any).phoneNumbers) ? (lead as any).phoneNumbers : []),
        lead.phone,
        (lead as any).mobile,
        contactSource?.phoneNumber,
        contactSource?.phone,
        contactSource?.mobile,
      ]
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
      const phone = Array.from(new Set(phoneCandidates)).join(", ");

      // Extract notes / description
      const notesValue = Array.isArray(lead.notes)
        ? (lead.notes[0]?.notes || lead.notes[0]?.description || "")
        : typeof lead.notes === "string" ? lead.notes : "";
      const descriptionValue =
        (typeof lead.description === "string" && lead.description) ||
        notesValue ||
        "";

      const tagList = Array.isArray(lead.tags)
        ? lead.tags.map((t: any) => (typeof t === "string" ? t : t?.name || t?.label || "")).filter(Boolean)
        : typeof lead.tags === "string"
          ? lead.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : [];

      setIsCustomSource(false);
      setCustomSourceValue("");
      setEditLeadTags(tagList);
      setEditLeadStatus(lead.leadStatus || lead.status || "active");

      // Set form (profile fields used by Edit Lead Profile dialog)
      setEditLeadForm({
        leadName: lead.leadName || lead.name || "",
        contactId: contactId || "",
        phone,
        initialStage: resolvedInitialStage || normalizeLeadStageValue(lead.stage) || "Prospects",
        source: lead.source || "",
        notes: notesValue,
        description: descriptionValue,
        companyId: companyId || "",
        email: lead.email || contactSource?.email || "",
        salesFunnelId: salesFunnelId || "",
        estimatedValue: String(lead.negotiatedPricing || lead.pricing || lead.estimatedValue || 0),
        assignedTo: assignedToId || "",
        priority: (lead.priority || "").toLowerCase(),
        nextFollowUp: formatDateForInput(lead.nextFollowUp),
        followUpIntervalDays: String(
          lead.followUpIntervalDays ?? lead.followUpDuration ?? lead.followUpInterval ?? ""
        ),
        autoFollowUpEndDate: formatDateForInput(
          lead.autoFollowUpEndDate ?? lead.followUpEndDate ?? lead.nextFollowUpEndDate
        ),
        estimatedClose: formatDateForInput(lead.estimatedClose),
        tags: tagList.join(", "),
        autoFollowUp: lead.autoFollowUp === true || lead.autoFollowUp === "on" || false,
      });

    } catch (error) {
      console.error("Error fetching lead:", error);
      toast.error("Failed to load lead data");
      setIsEditLeadOpen(false);
    } finally {
      setIsLoadingLead(false);
    }
  };

  // Save Lead profile (same payload shape as lead details Edit Lead Profile)
  const handleSaveLead = async () => {
    if (!editLeadId) return;
    setIsSavingLead(true);
    const loadingToast = toast.loading("Updating lead...");
    try {
      const body: Record<string, unknown> = {
        salesFunnel: editLeadForm.salesFunnelId || undefined,
        stage: editLeadForm.initialStage || undefined,
        source: editLeadForm.source || undefined,
        assignedTo: editLeadForm.assignedTo || undefined,
        description: editLeadForm.description || undefined,
        leadStatus: editLeadStatus || undefined,
        tags: editLeadTags,
      };

      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/leads/${editLeadId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (response.ok) {
        toast.success("Lead updated successfully!", { id: loadingToast });
        setIsEditLeadOpen(false);
        setEditLeadId(null);
        setIsCustomSource(false);
        setCustomSourceValue("");
        await refetchActivitiesFollowUps();
        await refreshCrmDashboardData();
        router.refresh();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || "Failed to update lead", { id: loadingToast });
      }
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Failed to update lead. Please try again.", { id: loadingToast });
    } finally {
      setIsSavingLead(false);
    }
  };

  const editLeadFollowUpPreview = useMemo(
    () =>
      buildFollowUpSchedulePreview(
        editLeadForm.nextFollowUp,
        editLeadForm.followUpIntervalDays,
        editLeadForm.autoFollowUpEndDate
      ),
    [editLeadForm.nextFollowUp, editLeadForm.followUpIntervalDays, editLeadForm.autoFollowUpEndDate]
  );

  const handleEditAutoFollowUpToggle = (checked: boolean) => {
    if (checked) {
      setEditLeadForm((prev) => ({ ...prev, autoFollowUp: true }));
      setIsEditAutoFollowUpConfigOpen(true);
      return;
    }

    setEditLeadForm((prev) => ({
      ...prev,
      autoFollowUp: false,
      followUpIntervalDays: "",
      autoFollowUpEndDate: "",
    }));
    setIsEditAutoFollowUpConfigOpen(false);
  };

  const handleEditAutoFollowUpConfigCancel = () => {
    setEditLeadForm((prev) => ({
      ...prev,
      autoFollowUp: false,
      followUpIntervalDays: "",
      autoFollowUpEndDate: "",
    }));
    setIsEditAutoFollowUpConfigOpen(false);
  };

  const handleEditAutoFollowUpConfigSave = () => {
    if (editLeadForm.nextFollowUp && editLeadForm.autoFollowUpEndDate) {
      const startDate = new Date(`${editLeadForm.nextFollowUp}T00:00:00`);
      const endDate = new Date(`${editLeadForm.autoFollowUpEndDate}T00:00:00`);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate < startDate) {
        toast.error("End date cannot be before next follow-up date");
        return;
      }
    }

    setIsEditAutoFollowUpConfigOpen(false);
  };

  return (
    <>
      <CRMPageLayout>
        <div className={`px-5 pt-3 pb-5 space-y-2 min-h-full ${dashboardTheme === "color" ? "" : "bg-[#121215]"}`}>
          {/* Dashboard Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2"></h1>
              <p className="text-sm text-muted-foreground">

              </p>
              {/* Debug Info - Remove after fixing */}
              {error && <div className="text-red-500 text-sm mt-2 p-2 bg-red-100 rounded">{error}</div>}
              <div className="text-xs font-mono text-gray-500 mt-2 p-2 bg-gray-100 rounded max-h-40 overflow-auto hidden">
                {debugInfo}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Leads Card */}
            <Card onClick={() => openLeadsListPopup("active")} className={`cursor-pointer hover:opacity-90 transition-opacity ${FIGMA_PANEL_CLASS} py-0`}>
              <CardContent className="p-[10px]">
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center gap-[7.5px]">
                    <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0">
                      <IconTotalLeads className="w-[13px] h-[13px] text-white" />
                    </div>
                    <p className="text-[12px] leading-[15px] font-normal text-white">
                      Total Leads
                    </p>
                  </div>
                  {isLoading ? (
                    <SkeletonLoader className="h-[38px] w-full" />
                  ) : (
                    <div className="bg-[#2E2E2E] rounded-[7.5px] px-[10px] py-[10px] w-full h-[38px] flex items-center">
                      <p className="text-[20px] leading-[18px] font-bold text-white">
                        {stats.leadCount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Leads Won Card */}
            <Card onClick={() => openLeadsListPopup("won")} className={`cursor-pointer hover:opacity-90 transition-opacity ${FIGMA_PANEL_CLASS} py-0`}>
              <CardContent className="p-[10px]">
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center gap-[7.5px]">
                    <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0">
                      <IconLeadsWon className="w-[13px] h-[12px] text-white" />
                    </div>
                    <p className="text-[12px] leading-[15px] font-normal text-white">
                      Leads Won
                    </p>
                  </div>
                  {isLoading ? (
                    <SkeletonLoader className="h-[38px] w-full" />
                  ) : (
                    <div className="bg-[#2E2E2E] rounded-[7.5px] px-[10px] py-[10px] w-full h-[38px] flex items-center">
                      <p className="text-[20px] leading-[18px] font-bold text-white">
                        {stats.leadsWon}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rate Card */}
            <Card className={`${FIGMA_PANEL_CLASS} py-0`}>
              <CardContent className="p-[10px]">
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center gap-[7.5px]">
                    <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0">
                      <IconConversionRate className="w-[15px] h-[11px] text-white" />
                    </div>
                    <p className="text-[12px] leading-[15px] font-normal text-white">
                      Conversion Rate
                    </p>
                  </div>
                  {isLoading ? (
                    <SkeletonLoader className="h-[38px] w-full" />
                  ) : (
                    <div className="bg-[#2E2E2E] rounded-[7.5px] px-[10px] py-[10px] w-full h-[38px] flex items-center">
                      <p className="text-[20px] leading-[18px] font-bold text-white">
                        {stats.conversionRate}%
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Estimated Revenue Card */}
            <Card className={`${FIGMA_PANEL_CLASS} py-0`}>
              <CardContent className="p-[10px]">
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center gap-[7.5px]">
                    <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0">
                      <IconEstimatedRevenue className="w-[13px] h-[13px] text-white" />
                    </div>
                    <p className="text-[12px] leading-[15px] font-normal text-white">
                      Estimated Revenue
                    </p>
                  </div>
                  {isLoading ? (
                    <SkeletonLoader className="h-[38px] w-full" />
                  ) : (
                    <div className="bg-[#2E2E2E] rounded-[7.5px] px-[10px] py-[10px] w-full h-[38px] flex items-center">
                      <p className="text-[20px] leading-[18px] font-bold text-white">
                        ₹{stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sales Funnel and Activities - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Sales Funnel */}
            <Card className={`${theme === "color"
              ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)] rounded-[12px]"
              : FIGMA_PANEL_CLASS
              } shadow-none py-0 gap-[25px] pt-[15px] pb-[25px] px-[15px]`}>
              <CardHeader className="p-0 gap-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={`text-[15px] leading-normal font-bold ${theme === "color" ? "text-white" : "text-white"
                      }`}>
                      Sales Funnel
                    </CardTitle>
                  </div>
                  <Popover open={isFunnelDropdownOpen} onOpenChange={setIsFunnelDropdownOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="w-[199px] h-[30px] text-[12px] font-normal bg-[#2E2E2E] border-none rounded-[7.5px] text-white flex items-center justify-between px-[10px] cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <span className="truncate">
                          {selectedFunnelFilter === "all"
                            ? "All Funnels"
                            : selectedFunnelFilter}
                        </span>
                        <ChevronDown className="h-3 w-3 text-white shrink-0 ml-1" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[199px] p-0 bg-[#2E2E2E] border-[#3a3a3a] rounded-[7.5px]">
                      <Command className="bg-[#2E2E2E] text-white">
                        <CommandInput
                          placeholder="Search funnels..."
                          value={funnelSearchTerm}
                          onValueChange={setFunnelSearchTerm}
                          className="text-[12px] text-white placeholder:text-zinc-500 h-8"
                        />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty className="text-[12px] text-zinc-500 py-2 text-center">
                            No funnels found.
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setSelectedFunnelFilter("all");
                                setFunnelSearchTerm("");
                                setIsFunnelDropdownOpen(false);
                              }}
                              className="text-[12px] text-white focus:bg-[#3a3a3a] focus:text-white cursor-pointer"
                            >
                              <Check className={`mr-2 h-3 w-3 shrink-0 ${selectedFunnelFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                              All Funnels
                            </CommandItem>
                            {funnelData.map((stage) => {
                              let label = stage.stage;
                              if (typeof label !== "string") {
                                label = (label as any)?.name || (label as any)?.stageName || String(label);
                              }
                              const labelStr = String(label);
                              return (
                                <CommandItem
                                  key={labelStr}
                                  value={labelStr}
                                  onSelect={() => {
                                    setSelectedFunnelFilter(labelStr);
                                    setFunnelSearchTerm("");
                                    setIsFunnelDropdownOpen(false);
                                  }}
                                  className="text-[12px] text-white focus:bg-[#3a3a3a] focus:text-white cursor-pointer"
                                >
                                  <Check className={`mr-2 h-3 w-3 shrink-0 ${selectedFunnelFilter === labelStr ? "opacity-100" : "opacity-0"}`} />
                                  {labelStr}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[350px]">
                    <div className="space-y-4 w-full">
                      {[1, 2, 3].map((i) => (
                        <SkeletonLoader key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  </div>
                ) : funnelData.length > 0 ? (
                  <div className="flex flex-col items-center gap-[25px]">
                    {/* Donut Chart */}
                    <div className="relative w-[300px] h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const filtered = selectedFunnelFilter === "all"
                                ? funnelData
                                : funnelData.filter((s) => {
                                  let label = s.stage;
                                  if (typeof label !== "string") {
                                    label = (label as any)?.name || (label as any)?.stageName || String(label);
                                  }
                                  return String(label) === selectedFunnelFilter;
                                });
                              return filtered.map((s) => {
                                let label = s.stage;
                                if (typeof label !== "string") {
                                  label = (label as any)?.name || (label as any)?.stageName || String(label);
                                }
                                return {
                                  name: String(label) || "Unknown",
                                  value: s.leads || 0,
                                  color: s.color || "#7b68ee",
                                };
                              });
                            })()}
                            cx="50%"
                            cy="50%"
                            innerRadius={110}
                            outerRadius={124}
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {(() => {
                              const filtered = selectedFunnelFilter === "all"
                                ? funnelData
                                : funnelData.filter((s) => {
                                  let label = s.stage;
                                  if (typeof label !== "string") {
                                    label = (label as any)?.name || (label as any)?.stageName || String(label);
                                  }
                                  return String(label) === selectedFunnelFilter;
                                });
                              return filtered.map((s, i) => (
                                <Cell key={i} fill={s.color || "#7b68ee"} />
                              ));
                            })()}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: theme === "color" ? "#121233" : "#141419",
                              border: `1px solid ${theme === "color" ? "rgba(0,255,255,0.2)" : "#22222f"}`,
                              borderRadius: "8px",
                              color: "#fff",
                              fontSize: "12px",
                            }}
                            itemStyle={{ color: "#fff" }}
                            labelStyle={{ color: "#fff" }}
                            formatter={(value: number, name: string) => [`${value} leads`, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className={`text-[28px] leading-8 font-bold ${theme === "color" ? "text-white" : "text-white"
                          }`}>
                          {(() => {
                            const filtered = selectedFunnelFilter === "all"
                              ? funnelData
                              : funnelData.filter((s) => {
                                let label = s.stage;
                                if (typeof label !== "string") {
                                  label = (label as any)?.name || (label as any)?.stageName || String(label);
                                }
                                return String(label) === selectedFunnelFilter;
                              });
                            return filtered.reduce((sum, s) => sum + (s.leads || 0), 0).toLocaleString();
                          })()}
                        </p>
                        <p className={`text-[12px] leading-4 ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-zinc-500"
                          }`}>
                          Total Leads
                        </p>
                      </div>
                    </div>

                    {/* Legend */}
                    {(() => {
                      const filtered = selectedFunnelFilter === "all"
                        ? funnelData
                        : funnelData.filter((s) => {
                            let label = s.stage;
                            if (typeof label !== "string") {
                              label = (label as any)?.name || (label as any)?.stageName || String(label);
                            }
                            return String(label) === selectedFunnelFilter;
                          });
                      const displayedStages = showAllStages ? filtered : filtered.slice(0, 5);
                      const isExpandedLegend = showAllStages && filtered.length > 5;
                      return (
                        <div className="w-full flex flex-col items-center gap-3">
                          <div
                            className={cn(
                              "w-full",
                              isExpandedLegend
                                ? "grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 justify-items-start"
                                : "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 max-w-[460px]"
                            )}
                          >
                            {displayedStages.map((stage, index) => {
                              let label = stage.stage;
                              if (typeof label !== "string") {
                                label = (label as any)?.name || (label as any)?.stageName || String(label);
                              }
                              return (
                                <div
                                  key={index}
                                  onClick={() => openStageLeadsPopup(String(label))}
                                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: stage.color || "#7b68ee" }}
                                  />
                                  <span className="text-[12px] leading-normal font-normal text-white">
                                    {String(label) || "Unknown"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {filtered.length > 5 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAllStages(!showAllStages)}
                              className="h-8 min-w-[120px] px-4 text-[12px] font-semibold rounded-[8px] border border-[#8b7aff] bg-[rgba(139,122,255,0.12)] text-[#c4b8ff] hover:bg-[rgba(139,122,255,0.22)] hover:text-white hover:border-[#a495ff] transition-colors"
                            >
                              {showAllStages ? "Show Less" : `View All (${filtered.length})`}
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className={`text-center py-4 h-[350px] flex items-center justify-center ${isDealsDarkTheme ? "text-[#9ca3af]" : dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-muted-foreground"
                    }`}>No funnel data available</div>
                )}
              </CardContent>
            </Card>

            {/* Activities & Followup */}
            <Card className={`${theme === "color"
              ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)] rounded-[12px]"
              : FIGMA_PANEL_CLASS
              } shadow-none py-0 gap-[15px] px-5 py-[15px] h-fit self-start`}>
              <CardHeader className="p-0 gap-0">
                <CardTitle className={`text-[15px] leading-normal font-bold ${theme === "color" ? "text-white" : "text-white"
                  }`}>
                  Activities & Followup
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex flex-col gap-[15px]">
                <div className="relative">
                  <Search
                    className={`pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280]"
                      }`}
                  />
                  <Input
                    type="search"
                    value={activitiesSearchInput}
                    onChange={(e) => setActivitiesSearchInput(e.target.value)}
                    placeholder="Search follow-ups..."
                    className={`h-[35px] pl-10 pr-9 py-0 text-[12px] leading-[35px] rounded-[22px] ${theme === "color"
                      ? "border-[rgba(0,255,255,0.2)] bg-[rgba(20,20,40,0.6)] text-white placeholder:text-[rgba(0,255,255,0.5)]"
                      : "border-[rgba(136,136,136,0.5)] bg-transparent text-[#e5e5e5] placeholder:text-[#6b7280]"
                      }`}
                    aria-label="Search activities and follow-ups"
                  />
                  {activitiesSearchInput ? (
                    <button
                      type="button"
                      onClick={() => setActivitiesSearchInput("")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-zinc-500"
                        } hover:bg-zinc-800`}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                  {isActivitiesSearchLoading ? (
                    <Loader2
                      className={`absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-zinc-500"
                        }`}
                    />
                  ) : null}
                </div>
                <Tabs defaultValue="today" className="w-full flex flex-col gap-4">
                  <TabsList className={activitiesFilterTabsListClass}>
                    <TabsTrigger
                      value="today"
                      className={activitiesFilterTabTriggerClass}
                    >
                      Today
                      {categorizedActivities.today.length > 0 && (
                        <span className="inline-flex items-center px-[6px] py-[2px] rounded-[10px] text-[11px] font-semibold bg-[#ef4444] text-white shrink-0 leading-none">
                          {categorizedActivities.today.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="next7days"
                      className={activitiesFilterTabTriggerClass}
                    >
                      Next 7 Days
                      {categorizedActivities.next7Days.length > 0 && (
                        <span className="inline-flex items-center px-[6px] py-[2px] rounded-[10px] text-[11px] font-semibold bg-[#ef4444] text-white shrink-0 leading-none">
                          {categorizedActivities.next7Days.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="pastdue"
                      className={activitiesFilterTabTriggerClass}
                    >
                      Overdue
                      {categorizedActivities.pastDue.length > 0 && (
                        <span className="inline-flex items-center px-[6px] py-[2px] rounded-[10px] text-[11px] font-semibold bg-[#ef4444] text-white shrink-0 leading-none">
                          {categorizedActivities.pastDue.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="today" className="mt-0 mb-0">
                    <div className="flex flex-col gap-[10px] max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                      {renderFollowUpActivities(categorizedActivities.today, "today")}
                    </div>
                  </TabsContent>

                  <TabsContent value="next7days" className="mt-0 mb-0">
                    <div className="flex flex-col gap-[10px]">
                      {next7DaysDayOptions.length > 0 && (
                        <div
                          ref={next7DaysChipsRef}
                          className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <button
                            type="button"
                            data-day-chip="all"
                            onClick={() => scrollToNext7DaySection("all")}
                            className={dayChipButtonClass(selectedNext7DaysDay === "all")}
                          >
                            All ({categorizedActivities.next7Days.length})
                          </button>
                          {next7DaysDayOptions.map((day) => (
                            <button
                              key={day.dayKey}
                              type="button"
                              data-day-chip={day.dayKey}
                              onClick={() => scrollToNext7DaySection(day.dayKey)}
                              className={dayChipButtonClass(selectedNext7DaysDay === day.dayKey)}
                            >
                              {day.label} ({day.count})
                            </button>
                          ))}
                        </div>
                      )}
                      <div
                        ref={next7DaysListRef}
                        className="flex flex-col gap-[10px] max-h-[450px] overflow-y-auto pr-1 custom-scrollbar scroll-smooth"
                      >
                        {renderFollowUpActivities(categorizedActivities.next7Days, "next 7 days", {
                          groupByDate: true,
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="pastdue" className="mt-0 mb-0">
                    <div className="flex flex-col gap-[10px]">
                      {overdueDayOptions.length > 0 && (
                        <div
                          ref={overdueChipsRef}
                          className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <button
                            type="button"
                            data-day-chip="all"
                            onClick={() => scrollToOverdueDaySection("all")}
                            className={dayChipButtonClass(selectedOverdueDay === "all")}
                          >
                            All ({categorizedActivities.pastDue.length})
                          </button>
                          {overdueDayOptions.map((day) => (
                            <button
                              key={day.dayKey}
                              type="button"
                              data-day-chip={day.dayKey}
                              onClick={() => scrollToOverdueDaySection(day.dayKey)}
                              className={dayChipButtonClass(selectedOverdueDay === day.dayKey)}
                            >
                              {day.label} ({day.count})
                            </button>
                          ))}
                        </div>
                      )}
                      <div
                        ref={overdueListRef}
                        className="flex flex-col gap-[10px] max-h-[450px] overflow-y-auto pr-1 custom-scrollbar scroll-smooth"
                      >
                        {renderFollowUpActivities(categorizedActivities.pastDue, "overdue", {
                          groupByDate: true,
                        })}
                      </div>
                    </div>
                  </TabsContent>

                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </CRMPageLayout>

      {/* Edit Follow-up — same shell as Edit Lead Profile */}
      <Dialog open={isEditFollowUpOpen} onOpenChange={setIsEditFollowUpOpen}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-[20px] border p-0 sm:max-w-[503px] [&>button]:hidden"
          style={{
            background: "#0f0f0f",
            borderColor: FIGMA.infoBorder,
            boxShadow: "2px 2px 2px black",
          }}
        >
          <div
            className="flex items-center justify-between border-b p-5"
            style={{ borderColor: FIGMA.infoBorder, background: "#0f0f0f" }}
          >
            <DialogTitle className="text-[15px] font-bold text-white">
              Edit Follow-up
            </DialogTitle>
            <button
              type="button"
              aria-label="Close"
              className="flex size-5 cursor-pointer items-center justify-center text-[#9a9a9a] transition-colors hover:text-white"
              onClick={() => setIsEditFollowUpOpen(false)}
              disabled={isSavingFollowUp}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: FIGMA.textSecondary }}>
                Title
              </label>
              <Input
                id="followup-title"
                value={editFollowUpData.title}
                onChange={(e) => setEditFollowUpData({ ...editFollowUpData, title: e.target.value })}
                placeholder="Follow-up title"
                className="h-9 rounded-lg border px-2.5 text-[13px] shadow-none focus-visible:ring-0"
                style={{
                  background: "#1e1e1e",
                  borderColor: FIGMA.border,
                  color: FIGMA.textPrimary,
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: FIGMA.textSecondary }}>
                Description
              </label>
              <Textarea
                id="followup-description"
                value={editFollowUpData.description}
                onChange={(e) => setEditFollowUpData({ ...editFollowUpData, description: e.target.value })}
                placeholder="Description"
                rows={3}
                className="min-h-[80px] rounded-lg border px-2.5 py-2 text-[13px] shadow-none focus-visible:ring-0"
                style={{
                  background: "#1e1e1e",
                  borderColor: FIGMA.border,
                  color: FIGMA.textPrimary,
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium" style={{ color: FIGMA.textSecondary }}>
                  Due Date
                </label>
                <Input
                  id="followup-duedate"
                  type="datetime-local"
                  value={editFollowUpData.dueDate}
                  onChange={(e) => setEditFollowUpData({ ...editFollowUpData, dueDate: e.target.value })}
                  className="h-9 rounded-lg border px-2.5 text-[13px] shadow-none focus-visible:ring-0 [color-scheme:dark]"
                  style={{
                    background: "#1e1e1e",
                    borderColor: FIGMA.border,
                    color: FIGMA.textPrimary,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium" style={{ color: FIGMA.textSecondary }}>
                  Priority
                </label>
                <Select
                  value={editFollowUpData.priority}
                  onValueChange={(val) => setEditFollowUpData({ ...editFollowUpData, priority: val })}
                >
                  <SelectTrigger
                    id="followup-priority"
                    className="h-9 w-full rounded-lg border px-2.5 text-[13px] shadow-none focus:ring-0"
                    style={{
                      background: "#1e1e1e",
                      borderColor: FIGMA.border,
                      color: FIGMA.textPrimary,
                    }}
                  >
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent
                    className="border text-white"
                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                  >
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: FIGMA.textSecondary }}>
                Status
              </label>
              <Select
                value={editFollowUpData.status}
                onValueChange={(val) => setEditFollowUpData({ ...editFollowUpData, status: val })}
              >
                <SelectTrigger
                  id="followup-status"
                  className="h-9 w-full rounded-lg border px-2.5 text-[13px] shadow-none focus:ring-0"
                  style={{
                    background: "#1e1e1e",
                    borderColor: FIGMA.border,
                    color: FIGMA.textPrimary,
                  }}
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent
                  className="border text-white"
                  style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                >
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className="flex items-center justify-between border-t px-6 py-[15px]"
            style={{ background: "#141414", borderColor: FIGMA.infoBorder }}
          >
            <button
              type="button"
              className="cursor-pointer text-[14px] font-semibold transition-colors hover:text-white disabled:opacity-50"
              style={{ color: FIGMA.textMuted }}
              onClick={() => setIsEditFollowUpOpen(false)}
              disabled={isSavingFollowUp}
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={handleSaveFollowUp}
              disabled={isSavingFollowUp}
              className="h-auto cursor-pointer rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90"
              style={{ background: FIGMA.accent, color: "#0f0f0f" }}
            >
              {isSavingFollowUp ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Profile - same fields as lead details page */}
      <EditLeadProfileDialog
        open={isEditLeadOpen}
        onOpenChange={(open) => {
          setIsEditLeadOpen(open);
          if (!open) {
            setEditLeadId(null);
            setIsCustomSource(false);
            setCustomSourceValue("");
          }
        }}
        form={{
          salesFunnelId: editLeadForm.salesFunnelId,
          stage: editLeadForm.initialStage,
          source: editLeadForm.source,
          assignedTo: editLeadForm.assignedTo,
          description: editLeadForm.description,
        }}
        onFormChange={(patch) => {
          setEditLeadForm((prev) => {
            const next = { ...prev };
            if (patch.salesFunnelId !== undefined) next.salesFunnelId = patch.salesFunnelId;
            if (patch.stage !== undefined) next.initialStage = patch.stage;
            if (patch.source !== undefined) next.source = patch.source;
            if (patch.assignedTo !== undefined) next.assignedTo = patch.assignedTo;
            if (patch.description !== undefined) next.description = patch.description;
            return next;
          });
        }}
        funnels={editFunnels}
        stages={editFunnelStages.map((s) => s.value || s.name).filter(Boolean)}
        sources={editSources}
        users={editOwners}
        isLoading={isLoadingLead || isEditStagesLoading}
        isSubmitting={isSavingLead}
        isCustomSource={isCustomSource}
        customSourceValue={customSourceValue}
        onCustomSourceChange={setCustomSourceValue}
        onToggleCustomSource={setIsCustomSource}
        onFunnelChange={(funnelId) => handleEditFunnelChange(funnelId)}
        onSave={handleSaveLead}
        leadStatus={editLeadStatus}
        currentTags={editLeadTags}
        onAddTag={(tag) => {
          const trimmed = tag.trim();
          if (!trimmed) return;
          setEditLeadTags((prev) =>
            prev.some((t) => t.toLowerCase() === trimmed.toLowerCase())
              ? prev
              : [...prev, trimmed]
          );
        }}
        onRemoveTag={(tag) => {
          setEditLeadTags((prev) => prev.filter((t) => t !== tag));
        }}
        onArchive={() => setEditLeadStatus("archived")}
        onCloseLost={() => setEditLeadStatus("lost")}
        onMarkWon={() => setEditLeadStatus("won")}
        onMakeActive={() => setEditLeadStatus("active")}
      />

      <Dialog
        open={isEditAutoFollowUpConfigOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsEditAutoFollowUpConfigOpen(true);
            return;
          }
          handleEditAutoFollowUpConfigCancel();
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Configure Auto Follow-up</DialogTitle>
            <DialogDescription>
              Set interval and end date for automatic follow-up creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-auto-follow-up-interval-days">Every N days</Label>
                <Input
                  id="edit-auto-follow-up-interval-days"
                  type="number"
                  min={1}
                  placeholder="Default: 2"
                  value={editLeadForm.followUpIntervalDays}
                  onChange={(e) =>
                    setEditLeadForm((prev) => ({ ...prev, followUpIntervalDays: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-auto-follow-up-end-date">End date</Label>
                <Input
                  id="edit-auto-follow-up-end-date"
                  type="date"
                  min={editLeadForm.nextFollowUp || undefined}
                  value={editLeadForm.autoFollowUpEndDate}
                  onChange={(e) =>
                    setEditLeadForm((prev) => ({ ...prev, autoFollowUpEndDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Defaults apply when left blank: every 2 days with 3 auto follow-ups.
            </p>
            {!editLeadForm.nextFollowUp ? (
              <p className="text-xs text-amber-600">
                Set &quot;Next Follow Up&quot; in the lead form to preview exact auto follow-up dates.
              </p>
            ) : editLeadFollowUpPreview.error ? (
              <p className="text-xs text-red-500">{editLeadFollowUpPreview.error}</p>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">
                  Preview: {editLeadFollowUpPreview.dueDates.length} follow-up
                  {editLeadFollowUpPreview.dueDates.length > 1 ? "s" : ""} every{" "}
                  {editLeadFollowUpPreview.intervalDays} day
                  {editLeadFollowUpPreview.intervalDays > 1 ? "s" : ""}.
                </p>
                <p className="text-muted-foreground">
                  Dates:{" "}
                  {editLeadFollowUpPreview.dueDates
                    .map((date) =>
                      date.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    )
                    .join(", ")}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleEditAutoFollowUpConfigCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleEditAutoFollowUpConfigSave}
              className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
            >
              Save Auto Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Follow-up Dialog for Dashboard Cards */}
      <Dialog open={isAutoFollowUpDialogOpen} onOpenChange={(open) => {
        if (open) {
          setIsAutoFollowUpDialogOpen(true);
          return;
        }
        handleAutoFollowUpDialogCancel();
      }}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto bg-[#1a1a24] border-[#3a3a3a] text-[#e5e5e5] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#555] [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader>
            <DialogTitle className="text-white">Auto Follow-up</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Enable Auto Follow-up Checkbox */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="dashboard-auto-follow-up"
                checked={autoFollowUpConfig.enableAutoFollowUp}
                onChange={(e) =>
                  setAutoFollowUpConfig((prev) => ({
                    ...prev,
                    enableAutoFollowUp: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-[#3a3a3a] bg-[#2a2a3a] text-[#8b7aff] focus:ring-[#8b7aff]"
              />
              <Label htmlFor="dashboard-auto-follow-up" className="text-[14px] text-white cursor-pointer">
                Enable auto follow-up
              </Label>
            </div>

            {/* Configure Section */}
            {autoFollowUpConfig.enableAutoFollowUp && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-[14px] font-medium text-white mb-1">Configure auto followup</h4>
                  <p className="text-[12px] text-[#9ca3af] leading-relaxed">
                    Set how often the AI sends follow-ups and when to stop. Frequency sets the
                    interval between each message (e.g. every 2 days, weekly). End Date is the
                    cutoff — after this date, no more follow-ups will be sent automatically.
                  </p>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-follow-up-title" className="text-[13px] text-[#d1d5db]">
                    Title
                  </Label>
                  <Input
                    id="dashboard-follow-up-title"
                    type="text"
                    placeholder="Enter follow-up title..."
                    value={autoFollowUpConfig.title}
                    onChange={(e) =>
                      setAutoFollowUpConfig((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="bg-[#2a2a3a] border-[#3a3a3a] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-follow-up-description" className="text-[13px] text-[#d1d5db]">
                    Description
                  </Label>
                  <Textarea
                    id="dashboard-follow-up-description"
                    placeholder="Enter follow-up description..."
                    rows={3}
                    value={autoFollowUpConfig.description}
                    onChange={(e) =>
                      setAutoFollowUpConfig((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="bg-[#2a2a3a] border-[#3a3a3a] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff] resize-none"
                  />
                </div>

                {/* Frequency of Followup */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-follow-up-frequency" className="text-[13px] text-[#d1d5db]">
                    Frequency of Followup
                  </Label>
                  <Input
                    id="dashboard-follow-up-frequency"
                    type="number"
                    min={1}
                    placeholder="e.g. Every 2 days, Weekly..."
                    value={autoFollowUpConfig.followUpIntervalDays}
                    onChange={(e) =>
                      setAutoFollowUpConfig((prev) => ({
                        ...prev,
                        followUpIntervalDays: e.target.value,
                      }))
                    }
                    className="bg-[#2a2a3a] border-[#3a3a3a] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff]"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-follow-up-end-date" className="text-[13px] text-[#d1d5db]">
                    End Date
                  </Label>
                  <Input
                    id="dashboard-follow-up-end-date"
                    type="date"
                    placeholder="Select end date..."
                    value={autoFollowUpConfig.autoFollowUpEndDate}
                    onChange={(e) =>
                      setAutoFollowUpConfig((prev) => ({
                        ...prev,
                        autoFollowUpEndDate: e.target.value,
                      }))
                    }
                    className="bg-[#2a2a3a] border-[#3a3a3a] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff]"
                  />
                </div>
                <p className="text-xs text-[#9ca3af]">
                  Defaults apply when left blank: every 2 days with 3 auto follow-ups.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row justify-between gap-3 sm:justify-between">
            <Button
              variant="outline"
              onClick={handleAutoFollowUpDialogCancel}
              className="border-[#3a3a3a] text-[#d1d5db] hover:bg-[#2a2a3a] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAutoFollowUpDialogSave}
              disabled={isSavingAutoFollowUp || !autoFollowUpConfig.enableAutoFollowUp}
              className="!bg-brand !hover:bg-[color:color-mix(in_srgb,var(--brand)_93%,black)] text-black font-semibold"
            >
              {isSavingAutoFollowUp ? "Saving..." : "Start Auto Follow Up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leads List Popup (Active / Won / Stage) */}
      <Dialog open={isLeadsListOpen} onOpenChange={setIsLeadsListOpen}>
        <DialogContent className={`max-w-4xl max-h-[80vh] flex flex-col ${dashboardTheme === "color"
          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
          : isDealsDarkTheme
            ? "bg-[#1a1a24] border-[#3a3a3a] text-[#e5e5e5]"
            : ""
          }`}>
          <DialogHeader>
            <DialogTitle className={dashboardTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : isDealsDarkTheme ? "text-[#f3f4f6]" : ""}>
              {leadsListType === "active" ? "Active Leads" : leadsListType === "won" ? "Won Leads" : `${leadsListStageName} Leads`}
            </DialogTitle>
            <DialogDescription className={dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : ""}>
              {isLeadsListLoading
                ? "Loading..."
                : `${leadsListTotalCount} ${leadsListType === "active" ? "active" : leadsListType === "won" ? "won" : leadsListStageName} leads found`}
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="relative -mx-2 px-2">
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.4)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-muted-foreground"
              }`} />
            <Input
              placeholder="Search leads..."
              value={leadsListSearch}
              onChange={(e) => setLeadsListSearch(e.target.value)}
              className={`pl-9 h-9 text-[14px] rounded-[6px] border-[0.667px] ${dashboardTheme === "color"
                ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.15)] text-white placeholder:text-[rgba(0,255,255,0.4)] focus:border-[rgba(0,255,255,0.3)]"
                : isDealsDarkTheme
                  ? "bg-[#111118] border-[#3a3a3a] text-[#e5e5e5] placeholder:text-[#9ca3af]"
                  : "bg-white border-[#e5e7eb] text-[#1f1f1f]"
                }`}
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
            {isLeadsListLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`h-6 w-6 animate-spin ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.5)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-muted-foreground"}`} />
                <span className={`ml-3 text-sm ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-muted-foreground"}`}>Loading leads...</span>
              </div>
            ) : leadsListData.length === 0 ? (
              <div className={`flex items-center justify-center py-12 text-sm ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-muted-foreground"}`}>
                No {leadsListType === "stage" ? leadsListStageName : leadsListType} leads found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className={`border-b-[0.667px] ${dashboardTheme === "color"
                      ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)]"
                      : isDealsDarkTheme
                        ? "bg-[rgba(42,42,42,0.3)] border-[#3a3a3a]"
                        : "bg-[rgba(244,245,247,0.5)] border-[#e5e7eb]"
                      }`}>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Lead Name</th>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Tags</th>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Owner</th>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Stage</th>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Value</th>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Next Follow-up</th>
                      <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const term = leadsListSearch.trim().toLowerCase();
                      const filtered = term
                        ? leadsListData.filter((lead: any) => {
                          const leadName = (lead.leadName || lead.name || lead.title || "").toLowerCase();
                          const ownerName = getOwnerDetails(lead).name.toLowerCase();
                          const tags = getTags(lead).join(" ").toLowerCase();
                          return leadName.includes(term) || ownerName.includes(term) || tags.includes(term);
                        })
                        : leadsListData;
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className={`text-center py-12 text-sm ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-muted-foreground"}`}>
                              No leads match your search.
                            </td>
                          </tr>
                        );
                      }
                      return filtered.map((lead: any) => {
                        const leadName = getLeadName(lead);
                        const ownerName = getOwnerDetails(lead).name;
                        const stageStr = getStageStringForPopup(lead.stage);
                        const pricing = lead.negotiatedPricing || lead.pricing || lead.estimatedValue || 0;
                        const nextFollowUp = getNextFollowUpForPopup(lead);
                        const tags = getTags(lead);
                        const priority = lead.priority || "medium";

                        return (
                          <tr
                            key={lead._id || lead.id}
                            onClick={() => {
                              const id = lead._id || lead.id;
                              if (id) { setIsLeadsListOpen(false); openLeadFromActivity(id); }
                            }}
                            className={`cursor-pointer transition-colors border-b ${dashboardTheme === "color"
                              ? "border-[rgba(0,255,255,0.08)] hover:bg-[rgba(0,255,255,0.05)]"
                              : isDealsDarkTheme
                                ? "border-[#2a2a2a] hover:bg-[rgba(42,42,42,0.5)]"
                                : "border-[#f3f4f6] hover:bg-[rgba(244,245,247,0.5)]"
                              }`}
                          >
                            <td className={`px-3 py-2 ${dashboardTheme === "color" ? "text-white" : isDealsDarkTheme ? "text-white" : "text-[#1f1f1f]"}`}>
                              <span className="font-bold text-[14px] leading-[20px]">{leadName}</span>
                            </td>
                            <td className={`px-3 py-2 ${dashboardTheme === "color" ? "text-white" : isDealsDarkTheme ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}>
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium border-[0.667px] capitalize ${priority === "high" ? "bg-red-100 text-red-700 border-red-200" : priority === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"
                                  }`}>{priority}</span>
                                {stageStr !== "-" && (
                                  <span className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium capitalize ${getStageColorForPopup(lead.stage)}`}>{stageStr}</span>
                                )}
                                {tags.length > 0 && tags.map((tag: string, idx: number) => {
                                  const color = getTagColor(idx);
                                  return (
                                    <span key={idx} className="px-2 py-0.5 rounded-[6px] text-[11px] font-medium border-[0.667px]" style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}>{tag}</span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className={`px-3 py-2 text-[14px] leading-[20px] ${dashboardTheme === "color" ? "text-white" : isDealsDarkTheme ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}>{ownerName}</td>
                            <td className="px-3 py-2">
                              <Badge className={`${getStageColorForPopup(lead.stage)} h-[21.833px] px-2 rounded-[6px] text-[11px] font-bold leading-[16.5px] border-[0.667px]`}>{stageStr}</Badge>
                            </td>
                            <td className={`px-3 py-2 ${dashboardTheme === "color" ? "text-white" : isDealsDarkTheme ? "text-white" : "text-[#1f1f1f]"}`}>
                              <span className="font-bold text-[14px] leading-[20px]">₹{Number(pricing).toLocaleString()}</span>
                            </td>
                            <td className={`px-3 py-2 text-[14px] leading-[20px] ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>{nextFollowUp}</td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <LeadContactQuickActions
                                lead={lead}
                                theme={dashboardTheme === "color" ? "color" : isDealsDarkTheme ? "dark" : "light"}
                              />
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {leadsListTotalPages > 1 && (
            <div className={`flex items-center justify-between border-t pt-3 mt-2 ${dashboardTheme === "color" ? "border-[rgba(0,255,255,0.2)]" : isDealsDarkTheme ? "border-[#3a3a3a]" : "border-[#e5e7eb]"
              }`}>
              <span className={`text-[12px] ${dashboardTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : isDealsDarkTheme ? "text-[#9ca3af]" : "text-[#6b7280]"
                }`}>
                Page {leadsListPage} of {leadsListTotalPages} ({leadsListTotalCount} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (leadsListType === "stage") {
                      openStageLeadsPopup(leadsListStageName, leadsListPage - 1);
                    } else {
                      openLeadsListPopup(leadsListType, leadsListPage - 1);
                    }
                  }}
                  disabled={leadsListPage <= 1 || isLeadsListLoading}
                  className={`h-8 w-8 flex items-center justify-center rounded-[6px] border transition-colors ${leadsListPage <= 1 || isLeadsListLoading
                    ? dashboardTheme === "color"
                      ? "border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.3)] cursor-not-allowed"
                      : isDealsDarkTheme
                        ? "border-[#3a3a3a] text-[#6b7280] cursor-not-allowed"
                        : "border-[#e5e7eb] text-[#9ca3af] cursor-not-allowed"
                    : dashboardTheme === "color"
                      ? "border-[rgba(0,255,255,0.2)] text-white hover:bg-[rgba(0,255,255,0.1)]"
                      : isDealsDarkTheme
                        ? "border-[#3a3a3a] text-[#e5e5e5] hover:bg-[#2a2a2a]"
                        : "border-[#e5e7eb] text-[#1f1f1f] hover:bg-gray-50"
                    }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (leadsListType === "stage") {
                      openStageLeadsPopup(leadsListStageName, leadsListPage + 1);
                    } else {
                      openLeadsListPopup(leadsListType, leadsListPage + 1);
                    }
                  }}
                  disabled={leadsListPage >= leadsListTotalPages || isLeadsListLoading}
                  className={`h-8 w-8 flex items-center justify-center rounded-[6px] border transition-colors ${leadsListPage >= leadsListTotalPages || isLeadsListLoading
                    ? dashboardTheme === "color"
                      ? "border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.3)] cursor-not-allowed"
                      : isDealsDarkTheme
                        ? "border-[#3a3a3a] text-[#6b7280] cursor-not-allowed"
                        : "border-[#e5e7eb] text-[#9ca3af] cursor-not-allowed"
                    : dashboardTheme === "color"
                      ? "border-[rgba(0,255,255,0.2)] text-white hover:bg-[rgba(0,255,255,0.1)]"
                      : isDealsDarkTheme
                        ? "border-[#3a3a3a] text-[#e5e5e5] hover:bg-[#2a2a2a]"
                        : "border-[#e5e7eb] text-[#1f1f1f] hover:bg-gray-50"
                    }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
