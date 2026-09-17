export const V5191_REQUIRED_FIELDS = {
  article: ["articleNumber", "description"],
  supplier: ["supplierId", "name"],
  location: ["locationId", "name"]
};

export function assertArray(name, value) {
  if (!Array.isArray(value)) {
    const error = new Error(`${name} muss ein Array sein.`);
    error.code = "CONVERTER_INPUT_INVALID";
    throw error;
  }
}
