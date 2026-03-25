/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  NotImplementedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MarksEntity } from './entities/marks.entity';
import { Repository } from 'typeorm';
import { SubjectsEntity } from './entities/subjects.entity';
import { CreateMarkDto } from './dtos/create-mark.dto';
import { ResourceByIdService } from '../resource-by-id/resource-by-id.service';
import { StudentsEntity } from '../profiles/entities/students.entity';
import { ParentsEntity } from '../profiles/entities/parents.entity';
import { TeachersEntity } from '../profiles/entities/teachers.entity';
import { ROLES } from '../auth/models/roles.enum';
import { UnauthorizedException } from '@nestjs/common';
import { CreateSubjectDto } from './dtos/create-subject.dto';
import { EnrolmentService } from 'src/enrolment/enrolment.service';
import { MarksProgressModel } from './models/marks-progress.model';
import { StudentsService } from 'src/profiles/students/students.service';

@Injectable()
export class MarksService {
  constructor(
    @InjectRepository(MarksEntity)
    private marksRepository: Repository<MarksEntity>,
    @InjectRepository(SubjectsEntity)
    private subjectsRepository: Repository<SubjectsEntity>,
    private resourceById: ResourceByIdService,
    private enrolmentService: EnrolmentService,
    private studentsService: StudentsService,
  ) {}

  async createSubject(
    createSubjectDto: CreateSubjectDto,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<SubjectsEntity> {
    // console.log(profile);

    switch (profile.role) {
      case ROLES.hod:
      case ROLES.parent:
      case ROLES.reception:
      case ROLES.student:
      case ROLES.teacher:
        throw new UnauthorizedException(
          'Only Admins allowed to create new subjects',
        );
    }

    return await this.subjectsRepository.save(createSubjectDto);
  }

  async getAllSubjects(): Promise<SubjectsEntity[]> {
    return await this.subjectsRepository.find();
  }

  async getOneSubject(subjectCode: string): Promise<SubjectsEntity> {
    const subject = await this.subjectsRepository.findOne({
      where: {
        code: subjectCode,
      },
    });

    if (!subject) {
      throw new NotFoundException(
        `Subject with code: ${subjectCode} not found`,
      );
    }

    return subject;
  }

  async deleteSubject(
    code: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<{ code: string }> {
    switch (profile.role) {
      case ROLES.hod:
      case ROLES.parent:
      case ROLES.reception:
      case ROLES.student:
      case ROLES.teacher:
        throw new UnauthorizedException('Only Admins can delete subjects');
    }

    const result = await this.subjectsRepository.delete(code);

    if (!result.affected) {
      throw new NotImplementedException(
        `Subject with code ${code} not deleted`,
      );
    }

    return { code };
  }

  async editSubject(subject: CreateSubjectDto): Promise<SubjectsEntity> {
    return await this.subjectsRepository.save({
      ...subject,
    });
  }

  async createMark(
    createMarkDto: CreateMarkDto,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity> {
    switch (profile.role) {
      case ROLES.student:
      case ROLES.parent:
      case ROLES.reception: {
        throw new UnauthorizedException('You are not allowed to enter marks');
      }
    }

    const { termId, name, mark, termMark, comment, subject, student, examType } =
      createMarkDto;

    const term = await this.enrolmentService.getOneTermById(termId);

    const found = await this.marksRepository.findOne({
      where: {
        term: { id: termId },
        name,
        examType,
        subject: { code: subject.code },
        student: { studentNumber: student.studentNumber },
      },
      relations: ['student', 'subject', 'term'],
    });

    if (found) {
      //edited mark

      //update the mark and comment only
      found.mark = mark;
      found.termMark = termMark ?? null;
      found.comment = comment;
      const id = found.id;

      await this.marksRepository.update(id, {
        mark,
        termMark: termMark ?? null,
        comment,
      });

      found.term = term;
      return found;
    } else {
      //new mark
      const record = new MarksEntity();
      record.term = term;
      record.name = name;
      record.mark = mark;
      record.termMark = termMark ?? null;
      record.comment = comment;
      record.subject = subject;
      record.student = student;
      record.examType = examType; //all new marks have examtype set

      try {
        await this.marksRepository.save(record);
        return record;
      } catch (err) {
        throw new NotImplementedException(err);
      }
    }
  }

  async getAllMarks(
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    switch (profile.role) {
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException(
          'You are not allowed to access all marks',
        );
      }
    }
    return await this.marksRepository.find({
      relations: ['student', 'subject', 'term'],
    });
  }

  /**
   * Marks for a class name + exam type, scoped by term id (canonical).
   */
  async getMarksByTermId(
    termId: number,
    name: string,
    examType: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    switch (profile.role) {
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException('You are not allowed');
      }
    }

    if (examType) {
      return await this.marksRepository.find({
        where: {
          term: { id: termId },
          name,
          examType,
        },
        relations: ['subject', 'student', 'term'],
      });
    }
    return [];
  }

  /** Resolves term from num/year then delegates to {@link getMarksByTermId}. */
  async getMarksbyClass(
    num: number,
    year: number,
    name: string,
    examType: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    const term = await this.enrolmentService.getOneTerm(num, year);
    return this.getMarksByTermId(term.id, name, examType, profile);
  }

  async getMarksByClassWithTermId(
    termId: number,
    name: string,
    examType: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    return this.getMarksByTermId(termId, name, examType, profile);
  }

  async getSubjectMarksInClass(
    termId: number,
    name: string,
    subjectCode: string,
    examType: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    switch (profile.role) {
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException('You are not authorised');
      }
    }

    const subject = await this.getOneSubject(subjectCode); //get the subject

    const term = await this.enrolmentService.getOneTermById(termId);

    const classlist = await this.enrolmentService.getEnrolmentByClassByTermId(
      name,
      termId,
    );

    let foundMarks: MarksEntity[] = []; //array to store the marks currently saved for the subject and class

    if (examType) {
      foundMarks = await this.marksRepository.find({
        where: {
          term: { id: termId },
          name,
          examType,
        },
        relations: ['subject', 'student', 'term'],
      });
    } else
      foundMarks = await this.marksRepository.find({
        where: {
          term: { id: termId },
          name,
        },
        relations: ['subject', 'student', 'term'],
      });

    const subjectMarks = foundMarks.filter(
      //filter the marks to remain with those of the concerned
      (mark) => mark.subject.code === subjectCode,
    );

    const classSubjectMarks: MarksEntity[] = [];

    classlist.map((enrol) => {
      const mark = new MarksEntity();

      mark.term = term;
      mark.name = name;
      mark.student = enrol.student;
      mark.subject = subject;
      if (examType) {
        mark.examType = examType;
      }

      classSubjectMarks.push(mark);
    });

    classSubjectMarks.map((mark) => {
      subjectMarks.map((mrk) => {
        if (mark.student.studentNumber === mrk.student.studentNumber) {
          mark.mark = mrk.mark;
          mark.termMark = mrk.termMark;
          mark.comment = mrk.comment;
          mark.id = mrk.id;
          // mark.examType = mrk.examType;
        }
      });
    });

    // console.log(classSubjectMarks[0]);

    return classSubjectMarks;
  }

  async getSubjectMarksInClassWithTermId(
    termId: number,
    name: string,
    subjectCode: string,
    examType: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    return this.getSubjectMarksInClass(
      termId,
      name,
      subjectCode,
      examType,
      profile,
    );
  }

  async getStudentMarks(studentNumber: string): Promise<MarksEntity[]> {
    return await this.marksRepository.find({
      where: { student: { studentNumber } },
      relations: ['subject', 'student', 'term'],
    });
  }

  /**
   * Get marks for a student with profile-based authorization.
   * - Admin/teachers/HOD can view any student's marks
   * - Parent can view marks for their own children
   * - Student can view their own marks
   */
  async getStudentMarksForProfile(
    studentNumber: string,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity[]> {
    if (!studentNumber) {
      throw new BadRequestException('Student number is required');
    }

    // Load the student to validate parent/student relationship
    const student = await this.studentsService.getStudent(
      studentNumber,
      profile,
    );

    // studentsService.getStudent already enforces:
    // - staff can see any
    // - parents only their children
    // - students only themselves
    // So if we got here without an exception, authorization is OK.

    return this.marksRepository.find({
      where: { student: { studentNumber: student.studentNumber } },
      relations: ['subject', 'student', 'term'],
    });
  }

  async deleteMark(
    id: number,
    profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ): Promise<MarksEntity> {
    switch (profile.role) {
      case ROLES.student:
      case ROLES.parent: {
        throw new UnauthorizedException('You are not authorised to edit marks');
      }
    }

    const mark = await this.marksRepository.findOne({
      where: {
        id,
      },
      relations: ['subject', 'student', 'term'],
    });

    if (mark) {
      const result = await this.marksRepository.delete(id);

      if (result.affected) {
        mark.comment = null;
        mark.mark = null;
        return mark;
      }
    }
  }

  async getPerfomanceData(
    termId: number,
    name: string,
    examType: string,
  ) {
    let marks: MarksEntity[] = [];

    if (examType)
      marks = await this.marksRepository.find({
        where: {
          term: { id: termId },
          name,
          examType,
        },
        relations: ['student', 'subject', 'term'],
      });
    else
      marks = await this.marksRepository.find({
        where: {
          term: { id: termId },
          name,
        },
        relations: ['student', 'subject', 'term'],
      });

    // const subjectsSet = new Set<SubjectsEntity>();
    const subjectsArray: SubjectsEntity[] = [];

    marks.map((mark) => {
      // subjectsSet.add(mark.subject);
      if (!subjectsArray.find((subj) => subj.code === mark.subject.code)) {
        subjectsArray.push(mark.subject);
      }
    });

    const subjectMarks: Array<MarksEntity[]> = [];
    const markArray: Array<number[]> = [];

    // subjectsArray = Array.from(subjectsSet);

    subjectsArray.map((subject) => {
      const subjectMarksArray: MarksEntity[] = marks.filter(
        (mark) => mark.subject.code === subject.code,
      );

      const arr = [];
      const marksArr = [];

      subjectMarksArray.map((mrk) => {
        const { name, mark, comment, student } = mrk;
        const topush = {
          name,
          mark,
          comment,
          studentName: student.name + ' ' + student.surname,
        };
        arr.push(topush);
        marksArr.push(mark);
      });

      // subjectMarks.push(subjectMarksArray);
      subjectMarks.push(arr);
      markArray.push(marksArr);
    });

    let xAxesLabels = [];
    for (let i = 0; i < markArray.length; i++) {
      if (markArray[i].length > xAxesLabels.length) {
        xAxesLabels = [...markArray[i]];
      }
    }

    for (let j = 0; j < xAxesLabels.length; j++) {
      xAxesLabels[j] = j + 1;
    }

    return {
      subjects: subjectsArray,
      subjectsMarks: subjectMarks,
      marks: markArray,
      xAxes: xAxesLabels,
      // subjectMarks: subjMrksArr,
    };
  }

  async fetchMarksProgress(
    termId: number,
    clas: string,
    examType: string,
    profile: TeachersEntity,
  ): Promise<any[]> {
    const marks = await this.getMarksByTermId(
      termId,
      clas,
      examType,
      profile,
    );

    // Create set of subjects in class
    const subjectsSet = new Set<string>(marks.map((mark) => mark.subject.name));

    const subjectsNames = Array.from(subjectsSet);

    const marksProgress: MarksProgressModel[] = [];

    const clasEnrolment = await this.enrolmentService.getEnrolmentByClassByTermId(
      clas,
      termId,
    );

    subjectsNames.forEach((subjectName) => {
      const marksForSubject = marks.filter(
        (mark) => mark.subject.name === subjectName,
      );
      const marksProgressItem: MarksProgressModel = {
        subject: marks.find((mark) => mark.subject.name === subjectName)
          .subject,
        marksEntered: marksForSubject.length,
        totalStudents: clasEnrolment.length,
        progress: (marksForSubject.length / clasEnrolment.length) * 100,
        className: clas,
      };
      marksProgress.push(marksProgressItem);
    });

    // marksProgress.sort((a, b) => {
    //   if (a.subject.code < b.subject.code) {
    //     return -1;
    //   } else if (a > b) {
    //     return 1;
    //   }
    //   return 0;
    // });

    // console.log(marksProgress[1]);

    return marksProgress;
  }
}
