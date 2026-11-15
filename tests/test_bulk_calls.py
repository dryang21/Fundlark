from datetime import date

from scripts.collect_bulk_calls import federal_record, horizon_record


AS_OF = date(2026, 11, 14)


def federal(**edits):
    source = dict(OpportunityID="100", OpportunityTitle="Small research grants", AgencyName="NSF",
                  AgencyCode="NSF", OpportunityCategory="D", FundingInstrumentType="G",
                  CategoryOfFundingActivity="ST", PostDate="11012026", CloseDate="12152026")
    return {k: [v] for k, v in (source | edits).items()}


def test_federal_distinguishes_real_window_archive_and_procurement():
    record = federal_record(federal(AwardCeiling="100000"), False, AS_OF)
    assert (record["status"], record["deadline"], record["amount_max"]) == ("verify", "2026-12-15", 100000)
    assert record["review_needed"]
    assert federal_record(federal(ArchiveDate="11132026"), False, AS_OF)["status"] == "closed"
    suspect = federal_record(federal(CloseDate="11102076"), False, AS_OF)
    assert suspect["status"] == "verify"
    assert "deadline" not in suspect and suspect["deadline_review"] == "distant_imported_date"
    assert federal_record(federal(CloseDate=""), False, AS_OF)["status"] == "verify"
    assert federal_record(federal(FundingInstrumentType="PC"), False, AS_OF) is None
    assert federal_record(federal(OpportunityCategory="C"), False, AS_OF) is None


def test_horizon_checks_dates_and_does_not_reopen_second_stage():
    metadata = dict(type=["1"], frameworkProgramme=["43108390"], language=["en"],
                    identifier=["HORIZON-EXAMPLE"], title=["Climate research"], status=["31094502"],
                    startDate=["2026-09-01"], deadlineDate=["2026-10-01", "2026-12-01"])
    generic = horizon_record({"metadata": metadata}, AS_OF)
    assert generic["status"] == "verify" and "application_phase" not in generic
    metadata["identifier"] = ["HORIZON-EXAMPLE-two-stage"]
    first = horizon_record({"metadata": metadata}, date(2026, 9, 14))
    assert (first["status"], first["application_phase"], first["deadline"]) == ("open", "initial", "2026-10-01")
    second = horizon_record({"metadata": metadata}, AS_OF)
    assert (second["status"], second["application_phase"], second["deadline"]) == ("verify", "invited_stage_two", "2026-12-01")
    metadata["deadlineDate"] = ["2026-10-01"]
    assert horizon_record({"metadata": metadata}, AS_OF) is None
