-- Create admission_enquiry table
CREATE TABLE public.admission_enquiry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  child_name TEXT NOT NULL,
  parents_name TEXT NOT NULL,
  date_of_birth DATE,
  age INTEGER,
  gender TEXT,
  address TEXT,
  nearby_road_name TEXT,
  mobile_no TEXT NOT NULL,
  referred_by TEXT,
  religion TEXT,
  nationality TEXT,
  course_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create followup table
CREATE TABLE public.admission_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enquiry_id UUID NOT NULL,
  followup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followup_type TEXT NOT NULL,
  remark TEXT,
  next_followup_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admission_enquiry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_followups ENABLE ROW LEVEL SECURITY;

-- RLS policies for admission_enquiry
CREATE POLICY "Users can view their own admission enquiries"
ON public.admission_enquiry FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own admission enquiries"
ON public.admission_enquiry FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own admission enquiries"
ON public.admission_enquiry FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own admission enquiries"
ON public.admission_enquiry FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for admission_followups
CREATE POLICY "Users can view followups for their enquiries"
ON public.admission_followups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM admission_enquiry
  WHERE admission_enquiry.id = admission_followups.enquiry_id
  AND admission_enquiry.user_id = auth.uid()
));

CREATE POLICY "Users can create followups for their enquiries"
ON public.admission_followups FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM admission_enquiry
  WHERE admission_enquiry.id = admission_followups.enquiry_id
  AND admission_enquiry.user_id = auth.uid()
));

CREATE POLICY "Users can update followups for their enquiries"
ON public.admission_followups FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM admission_enquiry
  WHERE admission_enquiry.id = admission_followups.enquiry_id
  AND admission_enquiry.user_id = auth.uid()
));

CREATE POLICY "Users can delete followups for their enquiries"
ON public.admission_followups FOR DELETE
USING (EXISTS (
  SELECT 1 FROM admission_enquiry
  WHERE admission_enquiry.id = admission_followups.enquiry_id
  AND admission_enquiry.user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_admission_enquiry_updated_at
BEFORE UPDATE ON public.admission_enquiry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();