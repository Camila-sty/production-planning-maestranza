# 🏭 Production Planning Maestranza

Sistema de planificación y gestión de producción para una maestranza, diseñado para optimizar la programación de equipos mediante modelos de optimización avanzados.

El sistema permite ingresar órdenes de trabajo, definir reglas operacionales (tiempos y capacidades) y ejecutar un motor de planificación que genera un calendario óptimo de producción.

---

## 🎯 Objetivo del proyecto

Este proyecto busca resolver el problema de:

- Planificar múltiples equipos en paralelo  
- Respetar capacidades diarias por proceso  
- Cumplir fechas de entrega  
- Priorizar trabajos según urgencia  
- Visualizar la planificación de forma clara (tipo Gantt)  

Utiliza técnicas de **optimización matemática (Constraint Programming - CP-SAT)** para generar soluciones eficientes.

---

## 🧱 Arquitectura del sistema

Usuario → Frontend (Next.js) → Backend/API → Motor de Optimización (Python)

---

## 📁 Estructura del proyecto
├── etp-app/ # Aplicación web (frontend + API)
│ ├── app/ # Vistas y UI
│ ├── components/ # Componentes reutilizables
│ ├── prisma/ # Base de datos (SQLite + Prisma)
│ └── api/ # Endpoints (planificación, CRUD)

├── scripts/ # Lógica de negocio y optimización
│ ├── planner.py # Motor CP-SAT (planificación)
│ └── seed_rules.py # Carga reglas desde Excel

├── data/ # Archivos de entrada (reglas)
│ ├── Reglas_Planificación.xlsx
│ ├── procesos.xlsx
│ └── otros archivos base

└── README.md

---

## 🧠 Tecnologías utilizadas

### Frontend / Backend
- Next.js (React)
- Node.js
- Prisma ORM
- SQLite

### Optimización
- Python
- Google OR-Tools (CP-SAT Solver)

### Datos
- Excel como fuente de reglas operativas

---
