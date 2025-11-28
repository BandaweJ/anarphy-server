import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { StudentsEntity } from '../profiles/entities/students.entity';
import { EnrolEntity } from '../enrolment/entities/enrol.entity';
import { MarkAttendanceDto } from './dtos/mark-attendance.dto';
import { TeachersEntity } from '../profiles/entities/teachers.entity';
import { StudentsEntity as StudentsEntityType } from '../profiles/entities/students.entity';
import { ParentsEntity } from '../profiles/entities/parents.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceEntity)
    private attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(StudentsEntity)
    private studentsRepository: Repository<StudentsEntity>,
    @InjectRepository(EnrolEntity)
    private enrolmentRepository: Repository<EnrolEntity>,
  ) {}

  async getClassAttendance(
    className: string,
    termNum: number,
    year: number,
    date?: string,
  ) {
    try {
      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);

      // Get enrolled students for the class and term
      const enrolments = await this.enrolmentRepository.find({
        where: {
          name: className,
          num: termNum,
          year,
        },
        relations: ['student'],
      });

      if (enrolments.length === 0) {
        throw new NotFoundException('No students found for the specified class and term');
      }

      // Get existing attendance records for the date
      const existingAttendance = await this.attendanceRepository.find({
        where: {
          name: className,
          num: termNum,
          year,
          date: targetDate,
        },
        relations: ['student'],
      });

      // Create a map of existing attendance
      const attendanceMap = new Map();
      existingAttendance.forEach(attendance => {
        // Only add to map if student is loaded
        if (attendance.student?.studentNumber) {
          attendanceMap.set(attendance.student.studentNumber, attendance);
        }
      });

      // Build the result with all students and their attendance status
      // Filter out enrolments where student is not loaded
      const result = enrolments
        .filter(enrolment => enrolment.student != null)
        .map(enrolment => {
          const existingRecord = attendanceMap.get(enrolment.student.studentNumber);
          return {
            id: existingRecord?.id || null,
            studentNumber: enrolment.student.studentNumber,
            surname: enrolment.student.surname,
            name: enrolment.student.name,
            gender: enrolment.student.gender,
            present: existingRecord?.present || false,
            date: targetDate,
            className,
            termNum,
            year,
            student: enrolment.student,
          };
        });

      return result;
    } catch (error) {
      console.error('Error in getClassAttendance:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }

  async markAttendance(
    markAttendanceDto: MarkAttendanceDto,
    profile: TeachersEntity | StudentsEntityType | ParentsEntity,
  ) {
    const { studentNumber, className, termNum, year, present, date } = markAttendanceDto;

    // Verify the student exists
    const student = await this.studentsRepository.findOne({
      where: { studentNumber },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Check if attendance record already exists for this date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const existingRecord = await this.attendanceRepository.findOne({
      where: {
        student: { studentNumber },
        name: className,
        num: termNum,
        year,
        date: targetDate,
      },
      relations: ['student'], // Load student relation
    });

    if (existingRecord) {
      // Update existing record
      existingRecord.present = present;
      const saved = await this.attendanceRepository.save(existingRecord);
      // Reload with student relation to ensure it's included in response
      return await this.attendanceRepository.findOne({
        where: { id: saved.id },
        relations: ['student'],
      });
    } else {
      // Create new record
      const attendanceRecord = this.attendanceRepository.create({
        student,
        name: className,
        num: termNum,
        year,
        present,
        date: targetDate,
      });

      const saved = await this.attendanceRepository.save(attendanceRecord);
      // Reload with student relation to ensure it's included in response
      return await this.attendanceRepository.findOne({
        where: { id: saved.id },
        relations: ['student'],
      });
    }
  }

  async getAttendanceReports(
    className: string,
    termNum: number,
    year: number,
    startDate?: string,
    endDate?: string,
  ) {
    // Get all students enrolled in this class for this term
    const enrolments = await this.enrolmentRepository.find({
      where: {
        name: className,
        num: termNum,
        year: year,
      },
      relations: ['student'],
    });

    const totalStudents = enrolments.length;
    const enrolledStudentNumbers = new Set(
      enrolments.map((e) => e.student.studentNumber),
    );

    // Get attendance records
    const queryBuilder = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.student', 'student')
      .where('attendance.name = :className', { className })
      .andWhere('attendance.num = :termNum', { termNum })
      .andWhere('attendance.year = :year', { year });

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('attendance.date BETWEEN :startDate AND :endDate', {
        startDate: start,
        endDate: end,
      });
    }

    const attendanceRecords = await queryBuilder
      .orderBy('attendance.date', 'ASC')
      .addOrderBy('student.surname', 'ASC')
      .getMany();

    // Group by date
    const recordsByDate = new Map<string, typeof attendanceRecords>();
    attendanceRecords.forEach((record) => {
      if (!record.student) return;
      const dateKey = record.date.toISOString().split('T')[0];
      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, []);
      }
      recordsByDate.get(dateKey)!.push(record);
    });

    // Calculate daily metrics
    const dailyMetrics = Array.from(recordsByDate.entries())
      .map(([date, records]) => {
        const presentCount = records.filter((r) => r.present).length;
        const absentCount = records.filter((r) => !r.present).length;
        const absentStudents = records
          .filter((r) => !r.present && r.student)
          .map((r) => ({
            studentNumber: r.student.studentNumber,
            surname: r.student.surname,
            name: r.student.name,
            gender: r.student.gender,
          }));

        // Possible attendance is the total enrolled students
        const possibleAttendance = totalStudents;
        const actualAttendance = presentCount;
        const attendanceRate =
          possibleAttendance > 0
            ? (actualAttendance / possibleAttendance) * 100
            : 0;

        return {
          date,
          possibleAttendance,
          actualAttendance,
          absentCount,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
          absentStudents,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate weekly summaries
    const weeklySummaries = this.calculateWeeklySummaries(
      dailyMetrics,
      startDate,
      endDate,
    );

    // Calculate trends
    const trends = this.calculateTrends(weeklySummaries);

    // Calculate overall stats
    const totalPossibleAttendance = dailyMetrics.reduce(
      (sum, day) => sum + day.possibleAttendance,
      0,
    );
    const totalActualAttendance = dailyMetrics.reduce(
      (sum, day) => sum + day.actualAttendance,
      0,
    );
    const overallAttendanceRate =
      totalPossibleAttendance > 0
        ? (totalActualAttendance / totalPossibleAttendance) * 100
        : 0;

    return {
      className,
      termNum,
      year,
      reportPeriod: {
        startDate: startDate || dailyMetrics[0]?.date || '',
        endDate: endDate || dailyMetrics[dailyMetrics.length - 1]?.date || '',
      },
      totalStudents,
      dailyMetrics,
      weeklySummaries,
      trends,
      overallStats: {
        totalPossibleAttendance,
        totalActualAttendance,
        overallAttendanceRate: Math.round(overallAttendanceRate * 100) / 100,
        totalDaysMarked: dailyMetrics.length,
      },
    };
  }

  private calculateWeeklySummaries(
    dailyMetrics: any[],
    startDate?: string,
    endDate?: string,
  ): any[] {
    if (dailyMetrics.length === 0) return [];

    const weeks = new Map<string, any[]>();

    dailyMetrics.forEach((day) => {
      const date = new Date(day.date);
      const weekStart = this.getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, []);
      }
      weeks.get(weekKey)!.push(day);
    });

    const weeklySummaries = Array.from(weeks.entries())
      .map(([weekStartDate, days], index) => {
        const weekStart = new Date(weekStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const totalPossible = days.reduce(
          (sum, day) => sum + day.possibleAttendance,
          0,
        );
        const totalActual = days.reduce(
          (sum, day) => sum + day.actualAttendance,
          0,
        );
        const avgRate =
          totalPossible > 0 ? (totalActual / totalPossible) * 100 : 0;

        return {
          weekStartDate,
          weekEndDate: weekEnd.toISOString().split('T')[0],
          weekNumber: index + 1,
          totalPossibleAttendance: totalPossible,
          totalActualAttendance: totalActual,
          averageAttendanceRate: Math.round(avgRate * 100) / 100,
          daysWithAttendance: days.length,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.weekStartDate).getTime() -
          new Date(b.weekStartDate).getTime(),
      );

    return weeklySummaries;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  }

  private calculateTrends(weeklySummaries: any[]): any[] {
    if (weeklySummaries.length < 2) return [];

    const trends = weeklySummaries.map((week, index) => {
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (index > 0) {
        const prevRate = weeklySummaries[index - 1].averageAttendanceRate;
        const currentRate = week.averageAttendanceRate;
        const diff = currentRate - prevRate;

        if (diff > 2) {
          trend = 'improving';
        } else if (diff < -2) {
          trend = 'declining';
        }
      }

      return {
        period: `Week ${week.weekNumber}`,
        attendanceRate: week.averageAttendanceRate,
        trend,
      };
    });

    return trends;
  }

  async getStudentAttendance(
    studentNumber: string,
    termNum: number,
    year: number,
    startDate?: string,
    endDate?: string,
  ) {
    const queryBuilder = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.student', 'student')
      .where('student.studentNumber = :studentNumber', { studentNumber })
      .andWhere('attendance.num = :termNum', { termNum })
      .andWhere('attendance.year = :year', { year });

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('attendance.date BETWEEN :startDate AND :endDate', {
        startDate: start,
        endDate: end,
      });
    }

    const attendanceRecords = await queryBuilder
      .orderBy('attendance.date', 'DESC')
      .getMany();

    // Transform records to match AttendanceRecord interface
    return attendanceRecords
      .filter(record => record.student != null) // Filter out records without student
      .map(record => ({
        id: record.id,
        studentNumber: record.student.studentNumber,
        surname: record.student.surname,
        name: record.student.name, // Student's first name
        gender: record.student.gender,
        present: record.present,
        date: record.date.toISOString().split('T')[0],
        className: record.name, // Class name from attendance.name
        termNum: record.num,
        year: record.year,
        student: record.student, // Keep full student object for reference
      }));
  }

  async getAttendanceSummary(className: string, termNum: number, year: number) {
    const attendanceRecords = await this.attendanceRepository.find({
      where: {
        name: className,
        num: termNum,
        year,
      },
      relations: ['student'],
    });

    // Calculate summary statistics
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(record => record.present).length;
    const absentCount = totalRecords - presentCount;
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

    // Group by student
    const studentStats = attendanceRecords.reduce((acc, record) => {
      const studentNumber = record.student.studentNumber;
      if (!acc[studentNumber]) {
        acc[studentNumber] = {
          student: record.student,
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
        };
      }
      acc[studentNumber].totalDays++;
      if (record.present) {
        acc[studentNumber].presentDays++;
      } else {
        acc[studentNumber].absentDays++;
      }
      return acc;
    }, {});

    // Calculate individual attendance rates
    Object.values(studentStats).forEach((stats: any) => {
      stats.attendanceRate = stats.totalDays > 0 ? (stats.presentDays / stats.totalDays) * 100 : 0;
    });

    return {
      className,
      termNum,
      year,
      totalRecords,
      presentCount,
      absentCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      studentStats: Object.values(studentStats),
    };
  }
}
