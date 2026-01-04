const apiKey = "ak_f3564082a3771d019bed4643907c78b24a674d7ff53a3f81"

const baseURL = "https://assessment.ksensetech.com/api";

const calculateBloodPressureRisk = (bp) => {
    if (bp === undefined || !bp.includes("/")) {
        return 0;
    }

    const [s, d] = bp.split("/");
    const systolic = parseInt(s);
    const diastolic = parseInt(d);

    // Check if the value is NAN in case received empty string or just a backspace
    if (isNaN(systolic) || isNaN(diastolic)) {
        return 0
    }

    // Stage 2 return 3 points
    if (systolic >= 140 || diastolic >= 90) {
        return 3;
    }

    // Stage 1 return 2 points
    if (systolic >= 130 || diastolic >= 80) {
        return 2;
    }

    // Elevated return 1 point
    if (systolic >= 120 && diastolic < 80) {
        return 1;
    }

    // All other cases return 0 points
    return 0;
}

const calculateTemperatureRisk = (temp) => {
    // Check if the value is NAN in case received nothing
    if (isNaN(temp)) {
        return 0
    }

    // High Fever return 2 points
    if (temp >= 101) {
        return 2;
    }

    // Low Fever return 1 point
    if (temp >= 99.6) {
        return 1;
    }

    // All other cases return 0 points
    return 0;
}

const calculateAgeRisk = (age) => {
    // Check if the value is NAN in case received empty nothing
    if (isNaN(age)) {
        return 0
    }

    // Over 65 return 2 points
    if (age > 65) {
        return 2;
    }

    // Over 40 return 1 point
    if (age >= 40) {
        return 1;
    }

    // All other cases return 0 points
    return 0;
}

const getPatientsInfo = async (page, maxRetry = 3) => {
    let retry = 0;

    while (retry < maxRetry) {
        try {
            const res = await fetch(`${baseURL}/patients?page=${page}&limit=20`, {
                headers: {
                    "x-api-key": apiKey
                }
            });

            if (res.ok) {
                return await res.json();
            }

            throw new Error(`HTTP error! Status: ${res.status}`);
        } catch (e) {
            retry++;

            if (retry >= maxRetry) {
                throw e;
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

const isDataQualityInvalid = (p) => {
    if (!p.blood_pressure || !p.blood_pressure.includes("/")) {
        return true;
    }

    const [s, d] = p.blood_pressure.split("/");

    if (isNaN(parseInt(s)) || isNaN(parseInt(d))) {
        return true;
    }

    if (isNaN(p.temperature)) {
        return true;
    }

    if (isNaN(p.age) || p.age === null) {
        return true;
    }

    return false;
}

const getAllPatients = async () => {
    const highRisk = [], fever = [], dataIssues = [];
    let hasNext = true;
    let page = 1;
    let patients = [];

    while (hasNext) {
        const result = await getPatientsInfo(page);
        patients = [...patients, ...result.data];
        console.log(result);
        hasNext = result.pagination?.hasNext;
        page++;
    }

    console.log(`Total patients fetched: ${patients.length}`);

    for (const p of patients) {
        const bp = calculateBloodPressureRisk(p.blood_pressure);
        const temp = calculateTemperatureRisk(p.temperature);
        const age = calculateAgeRisk(p.age);
        const score = bp + temp + age;

        if (score >= 4) {
            highRisk.push(p.patient_id);
        }

        if (temp > 0) {
            fever.push(p.patient_id);
        }

        if (isDataQualityInvalid(p)) {
            dataIssues.push(p.patient_id);
        }
    }

    await submitRequest(highRisk, fever, dataIssues);
}

const submitRequest = async (highRisk, fever, dataIssues) => {
    console.log("highRisk", highRisk)
    console.log("fever", fever)
    console.log("dataIssues", dataIssues)

    const res = await fetch(`${baseURL}/submit-assessment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
        },
        body: JSON.stringify({
            high_risk_patients: highRisk,
            fever_patients: fever,
            data_quality_issues: dataIssues,
        }),
    });

    const result = await res.json();
    console.log("Response", JSON.stringify(result, null, 2));
}

getAllPatients();