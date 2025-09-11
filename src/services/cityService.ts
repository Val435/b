import fs from "fs";
import path from "path";
import readline from "readline";

export type City = {
  city: string;
  state_id: string;
};

let cities: City[] = [];

export const loadCities = async (): Promise<void> => {
  const filePath = path.join(__dirname, "../../data/uscities.csv");

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  for await (const line of rl) {
    // Quita comillas dobles y divide por coma
    const values = line.split(",").map((v) => v.replace(/^"|"$/g, ""));

    if (!headers.length) {
      headers = values;
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i]));

    cities.push({
      city: row["city_ascii"],
      state_id: row["state_id"],
    });
  }
};

export const searchCities = (
  stateId: string,
  query: string,
  limit = 5
): City[] => {
  const stateCities = cities.filter(
    (c) => c.state_id.toLowerCase() === stateId.toLowerCase()
  );

  const matches = stateCities.filter((c) =>
    c.city.toLowerCase().includes(query.toLowerCase())
  );

  return matches.slice(0, limit);
};