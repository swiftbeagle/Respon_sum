import 'axios';
import axios from 'axios';
import { ID, Stats, Student } from '../types/api';
import { BASE_URL } from './api';

export const getStudentId = async (id: ID): Promise<any> => {
  return axios.get(`http://${BASE_URL}/students/${id}`);
};

export const putStudentId = async (id: ID, student: Student): Promise<any> => {
  return axios.put(`http://${BASE_URL}/students/${id}`, student);
};

export const createStudent = async (student: Student): Promise<any> => {
  return axios.post(`http://${BASE_URL}/students`, student);
};
