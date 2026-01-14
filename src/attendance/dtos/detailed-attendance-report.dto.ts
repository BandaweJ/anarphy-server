export interface DailyAttendanceMetrics {
  date: string;
  possibleAttendance: number; // Total students enrolled in class
  actualAttendance: number; // Number of students present
  absentCount: number; // Number of students absent
  attendanceRate: number; // Percentage
  absentStudents: AbsentStudent[];
}

export interface AbsentStudent {
  studentNumber: string;
  surname: string;
  name: string;
  gender: string;
}

export interface WeeklyAttendanceSummary {
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  totalPossibleAttendance: number; // Sum of possible attendance for the week
  totalActualAttendance: number; // Sum of actual attendance for the week
  averageAttendanceRate: number;
  daysWithAttendance: number; // Number of days attendance was marked
}

export interface AttendanceTrend {
  period: string; // e.g., "Week 1", "Week 2", or date range
  attendanceRate: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface DetailedAttendanceReport {
  className: string;
  termNum: number;
  year: number;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  totalStudents: number; // Total students enrolled in class
  dailyMetrics: DailyAttendanceMetrics[];
  weeklySummaries: WeeklyAttendanceSummary[];
  trends: AttendanceTrend[];
  overallStats: {
    totalPossibleAttendance: number;
    totalActualAttendance: number;
    overallAttendanceRate: number;
    totalDaysMarked: number;
  };
}










