"""Structured data extracted from a benefit case (ZAM, Z-3, Z-3a, ZAS-53, e-ZLA, insurance certificate, ...).

Used as the Gemini response schema, so every field is optional: the model must return null instead of guessing.
Amounts are in PLN, dates are YYYY-MM-DD.
"""
from typing import Literal

from pydantic import BaseModel, Field

DocumentType = Literal['ZAM', 'ZUR', 'ZAO', 'Z-3', 'Z-3a', 'Z-3b', 'ZAS-53', 'ZAS-12', 'e-ZLA',
                       'poswiadczenie_ubezpieczenia', 'zrzut_systemu_ZUS', 'zaswiadczenie_lekarskie',
                       'akt_urodzenia', 'decyzja_ZUS', 'inny']


class CaseDocument(BaseModel):
    type: DocumentType
    title: str | None = Field(None, description = 'Nazwa dokumentu tak, jak widnieje w pliku')
    summary: str = Field(description = 'Jedno zdanie po polsku: co ten dokument potwierdza')


class SalaryMonth(BaseModel):
    month: str | None = Field(None, description = 'Miesiąc w formacie YYYY-MM')
    gross_salary: float | None = Field(None, description = 'Wynagrodzenie brutto za miesiąc (pracownik)')
    contribution_basis: float | None = Field(
        None, description = 'Podstawa wymiaru składki na ubezpieczenie chorobowe (zlecenie / działalność)')
    worked_less_than_half: bool | None = Field(None, description = 'Przepracowano mniej niż połowę czasu pracy')


class LeavePeriod(BaseModel):
    type: Literal['maternity', 'maternity_conditions', 'supplementary_maternity', 'parental', 'paternity']
    parent: Literal['mother', 'father', 'unknown'] = 'unknown'
    start_date: str | None = None
    end_date: str | None = None
    work_fte: float | None = Field(None, description = 'Wymiar pracy w trakcie urlopu rodzicielskiego, np. 0.5')


class IncapacityPeriod(BaseModel):
    start_date: str | None = None
    end_date: str | None = None
    pregnancy_code_b: bool | None = Field(None, description = 'Czy e-ZLA ma kod literowy „B” (ciąża)')


class ZusDecision(BaseModel):
    granted: bool | None = Field(None, description = 'Czy świadczenie przyznano')
    benefit: str | None = Field(None, description = 'Którego świadczenia dotyczy decyzja')
    amount: float | None = Field(None, description = 'Kwota świadczenia podana w dokumentach')
    reason: str | None = Field(None, description = 'Uzasadnienie (szczególnie przy odmowie)')


class CaseExtraction(BaseModel):
    summary: str = Field(description = '2–3 zdania po polsku: czego dotyczy sprawa')
    documents: list[CaseDocument] = []

    person_role: Literal['mother', 'father', 'unknown'] = 'unknown'
    employment_type: Literal['employee', 'contract', 'business', 'other', 'unknown'] = Field(
        'unknown', description = 'employee = umowa o pracę, contract = umowa zlecenia, business = działalność')
    insurance_kind: Literal['mandatory', 'voluntary', 'unknown'] = 'unknown'
    sickness_insured: bool | None = Field(None, description = 'Czy osoba podlega ubezpieczeniu chorobowemu')
    insurance_start_date: str | None = None
    insurance_end_date: str | None = Field(None, description = 'Data ustania ubezpieczenia, jeśli ustało')
    payer_over_20_insured: bool | None = Field(
        None, description = 'Płatnik zgłasza do ubezpieczenia chorobowego ponad 20 osób (sam wypłaca zasiłki)')
    full_time: bool | None = None

    monthly_basis: float | None = Field(None, description = 'Podstawa wymiaru zasiłku, jeśli jest podana wprost')
    salary_months: list[SalaryMonth] = []
    quarterly_bonuses_last_4_quarters: float | None = None
    annual_bonuses_last_year: float | None = None
    contribution_debt: float | None = Field(None, description = 'Zadłużenie z tytułu składek')

    event: Literal['birth', 'adoption', 'foster', 'pregnancy', 'unknown'] = 'unknown'
    event_date: str | None = Field(None, description = 'Data porodu albo przyjęcia dziecka na wychowanie')
    expected_birth_date: str | None = None
    children_count: int | None = None
    child_birth_date: str | None = Field(None, description = 'Data urodzenia dziecka (adopcja / rodzina zastępcza)')
    za_zyciem: bool | None = Field(None, description = 'Zaświadczenie „Za życiem”')
    combined_application_within_21_days: bool | None = Field(
        None, description = 'Wniosek o zasiłek za urlop macierzyński i rodzicielski złożony do 21 dni po porodzie (81,5%)')

    leave_periods: list[LeavePeriod] = []
    incapacity_periods: list[IncapacityPeriod] = []
    employment_end_date: str | None = None
    job_loss_reason: Literal['employer_insolvency', 'unlawful_termination', 'other'] | None = None

    zus_decision: ZusDecision | None = None
    warnings: list[str] = Field([], description = 'Po polsku: brakujące dane, niespójności, ryzyka dla prawa do zasiłku')
